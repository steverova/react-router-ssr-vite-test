import { lazy } from "react";
import type { RouteObject } from "react-router";

const HomePage = lazy(() => import("../client/pages/home.tsx"));
const AboutPage = lazy(() => import("../client/pages/about.tsx"));
const DasboardPage = lazy(() => import("../client/pages/dasboard.tsx"));
const NotFoundPage = lazy(() => import("../client/pages/not-found.tsx"));

const routes: RouteObject[] = [
	{
		path: "/",
		Component: HomePage,
	},
	{
		path: "about",
		Component: AboutPage,
	},
	{
		path: "dasboard",
		Component: DasboardPage,
	},
	{
		path: "*",
		Component: NotFoundPage,
	},
];

export default routes;
