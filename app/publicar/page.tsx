import { redirect } from "next/navigation";

// El panel ya no publica (ver ADR-0020): todo arranca como una Idea.
export default function PublicarPage() {
  redirect("/ideas/nueva");
}
