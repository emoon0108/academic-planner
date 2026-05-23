import { runCatalogResearchCycle } from "../ai/catalogResearchAgent";

async function main() {
  const state = await runCatalogResearchCycle();
  const latest = state.updates.slice(0, 3);

  console.log(`Catalog research agent completed at ${state.updatedAt}.`);
  for (const update of latest) {
    console.log(
      `- ${update.schoolName} / ${update.majorName}: ${update.sources.length} sources, ${update.extractedCourses.length} course hints, ${update.requirementHints.length} requirement hints (${update.confidence})`
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
