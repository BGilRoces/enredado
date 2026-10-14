import { manejarPeticionMcp, metodoNoPermitido } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  return manejarPeticionMcp(request, token);
}

export const GET = metodoNoPermitido;
export const DELETE = metodoNoPermitido;
