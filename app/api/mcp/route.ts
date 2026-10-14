import { manejarPeticionMcp, metodoNoPermitido } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return manejarPeticionMcp(request, null);
}

export const GET = metodoNoPermitido;
export const DELETE = metodoNoPermitido;
