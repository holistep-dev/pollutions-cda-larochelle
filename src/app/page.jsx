import Carte from "../components/Carte";
import { libelles } from "../lib/donnees";

export const metadata = {
  title: { absolute: "Pollutions documentées dans l'agglomération de La Rochelle" },
  description:
    "Carte des pollutions mesurées, diagnostiquées ou instruites sur les 28 communes de l'agglomération de La Rochelle : sols, décharges, plages, eau du robinet, air.",
  alternates: { canonical: "/" },
};

export default function Accueil() {
  return <Carte bandeau={libelles().bandeau_signaux_sanitaires} />;
}
