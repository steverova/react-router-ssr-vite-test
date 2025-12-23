
import { useEffect } from "react"
import { fetchHomeData } from "../../server/server-test"

function HomePage() {


  useEffect(() => {
    const fetchData = async () => {
      const response = await fetchHomeData();
      console.log("Data fetched from server:", response);
    };
    fetchData();
  }, [])

  return (
    <div>HomePage</div>
  )
}

export default HomePage