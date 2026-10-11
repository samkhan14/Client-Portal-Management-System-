import { cookies } from "next/headers";
import { actorFromToken, SESSION_COOKIE } from "@/lib/auth/session";

export async function getActor() {
  const jar = await cookies();
  return actorFromToken(jar.get(SESSION_COOKIE)?.value);
}
