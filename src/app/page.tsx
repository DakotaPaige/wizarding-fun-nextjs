import { executeQuery } from "@/graphql/execute";
import { HouseSelectionProvider } from "@/components/house-selection";
import { MapNav } from "@/components/MapNav";
import { IntroSection } from "@/sections/intro";
import { SpellsSection } from "@/sections/spells";
import { CharactersSection } from "@/sections/characters";
import { QuizSection } from "@/sections/quiz";
import { FooterSection } from "@/sections/footer";
import { PageDataQuery } from "./page.query";

/** HP-API data changes rarely; rebuild the page at most once a day. */
export const revalidate = 86400;

export default async function Home() {
  const { houses, spells } = await executeQuery(PageDataQuery);
  return (
    <HouseSelectionProvider>
      <MapNav />
      <main>
        <IntroSection />
        <SpellsSection spells={spells} />
        <CharactersSection houses={houses} />
        <QuizSection />
      </main>
      <FooterSection />
    </HouseSelectionProvider>
  );
}
