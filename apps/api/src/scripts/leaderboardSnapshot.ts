import { createAppContext } from "../appContext";

// CLI: npm run leaderboard:snapshot
async function main() {
  const context = createAppContext({ autoProcessSubmissions: false });
  const snapshots = await context.services.leaderboards.snapshot();
  console.log(`Created ${snapshots.length} leaderboard snapshot rows`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
