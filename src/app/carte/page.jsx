import { redirect } from "next/navigation";

// La carte est désormais la page d'accueil.
export default function AncienneCarte() {
  redirect("/");
}
