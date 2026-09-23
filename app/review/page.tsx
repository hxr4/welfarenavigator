import Review from "@/components/Review";
import { dataset } from "@/lib/data/load";

export const metadata = { title: "Reviewer · Welfare Navigator" };

export default function ReviewPage() {
  return <Review ds={dataset} />;
}
