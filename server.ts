import fs from "node:fs/promises";
import { Transform } from "node:stream";
import type {
	Request as ExpressRequest,
	Response as ExpressResponse,
} from "express";
import express from "express";
import type { StaticHandlerContext } from "react-router";
import { createStaticHandler } from "react-router";
import type { ViteDevServer } from "vite";
import routes from "./src/router/routes.ts";
import apiRouter from "./src/server/api/index.ts";
import { de } from "zod/locales";

// Constants
const isProduction: boolean = process.env.NODE_ENV === "production";
const port: number | string = process.env.PORT || 5173;
const base: string = process.env.BASE || "/";
const ABORT_DELAY: number = 10000;

// Cached production assets
const templateHtml: string = isProduction
	? await fs.readFile("./dist/client/index.html", "utf-8")
	: "";

// Create http server
const app = express();

// Add Vite or respective production middlewares
let vite: ViteDevServer | undefined;
if (!isProduction) {
	const { createServer } = await import("vite");
	vite = await createServer({
		server: { middlewareMode: true },
		appType: "custom",
		base,
	});
	app.use(vite.middlewares);
	app.use("/api", apiRouter);
} else {
	const compression = (await import("compression")).default;
	const sirv = (await import("sirv")).default;
	app.use(compression());
	app.use(base, sirv("./dist/client", { extensions: [] }));
}

const handler = createStaticHandler(routes);

// Serve HTML
app.use(
	"*all",
	async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
		try {
			let url: string = req.originalUrl.replace(base, "");
			if (!url.startsWith("/")) {
				url = `/${url}`;
			}

			const fetchRequest = new Request(`http://localhost:${port}${url}`, {
				method: req.method,
				headers: new Headers(req.headers as Record<string, string>),
			});

			const queryResult = await handler.query(fetchRequest);

			// Si es una Response (redirect, error), envíala directamente
			if (queryResult instanceof Response) {
				res.status(queryResult.status);
				queryResult.headers.forEach((value, key) => {
					res.setHeader(key, value);
				});
				res.end(await queryResult.text());
				return;
			}

			const context: StaticHandlerContext = queryResult;

			let template: string;
			let render: (
				url: string,
				context: StaticHandlerContext,
				options?: any,
			) => any;

			if (!isProduction) {
				// Always read fresh template in development
				template = await fs.readFile("./index.html", "utf-8");
				template = await vite!.transformIndexHtml(url, template);
				render = (await vite!.ssrLoadModule("/src/entry-server.tsx")).render;
			} else {
				template = templateHtml;
				render = (await import("./dist/server/entry-server.js")).render;
			}

			let didError: boolean = false;

			const { pipe, abort } = render(url, context, {
				onShellError(): void {
					res.status(500);
					res.set({ "Content-Type": "text/html" });
					res.send("<h1>Something went wrong</h1>");
				},
				onShellReady(): void {
					res.status(didError ? 500 : 200);
					res.set({ "Content-Type": "text/html" });

					const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`);
					const htmlEnded: boolean = false;

					const transformStream = new Transform({
						transform(chunk: any, encoding: string, callback: Function): void {
							// See entry-server.tsx for more details of this code
							if (!htmlEnded) {
								chunk = chunk.toString();
								if (
									chunk.endsWith("<vite-streaming-end></vite-streaming-end>")
								) {
									res.write(chunk.slice(0, -41) + htmlEnd);
								} else {
									res.write(chunk);
								}
							} else {
								res.write(chunk);
							}
							callback();
						},
					});

					transformStream.on("finish", (): void => {
						res.end();
					});

					res.write(htmlStart);

					pipe(transformStream);
				},
				onError(error: Error): void {
					didError = true;
					console.error(error);
				},
			});

			setTimeout((): void => {
				abort();
			}, ABORT_DELAY);
		} catch (e) {
			vite?.ssrFixStacktrace(e as Error);
			console.log((e as Error).stack);
			res.status(500).end((e as Error).stack);
		}
	},
);

export default app;

// Start server
