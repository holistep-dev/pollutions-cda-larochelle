import Carte from "../../components/Carte";
import { libelles } from "../../lib/donnees";

export const metadata = {
  title: "Carte",
  description: "Carte des pollutions documentées sur les 28 communes de l'agglomération de La Rochelle.",
  alternates: { canonical: "/carte" },
};

export default function PageCarte() {
  return <Carte bandeau={libelles().bandeau_signaux_sanitaires} />;
}
