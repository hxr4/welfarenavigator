import Navigator from "@/components/Navigator";
import { dataset } from "@/lib/data/load";

export default function Home() {
  return <Navigator ds={dataset} />;
}
