import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";

export default async function Home() {
  redirect((await getSession()) ? "/dashboard" : "/login");
}
