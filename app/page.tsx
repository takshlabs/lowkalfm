import { HomeGathering } from "@/components/HomeGathering";
import { HomeIndexStrip } from "@/components/HomeIndexStrip";
import { HomeProgrammeIndex } from "@/components/HomeProgrammeIndex";
import { HomeSessionShelf } from "@/components/HomeSessionShelf";
import { HomeStage } from "@/components/HomeStage";
import { HomeStrip } from "@/components/HomeStrip";

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="home" id="main">
      <HomeStage />
      <HomeIndexStrip />
      <HomeStrip />
      <HomeSessionShelf />
      <HomeProgrammeIndex />
      <HomeGathering />
    </main>
  );
}
