# ClearPick

ClearPick is a sports prediction and decision-training prototype. It lets users make simulated picks without real money, then evaluates both the outcome and the quality of the decision process.

The prototype includes:

- NFL, NBA, MLB, NHL, college football, college basketball, and EPL matchups;
- simulated winner, spread, and total predictions;
- confidence and evidence tracking;
- quick emotional-state and decision-speed checks;
- reflection prompts when confidence outruns evidence;
- a process-weighted Decision Score;
- decision replay after a result; and
- early behavioral insights and calibration patterns.

ClearPick deliberately avoids wagering, payouts, casino imagery, artificial urgency, near-miss effects, compulsive streak pressure, and loss-framed engagement. When market lines are shown, they are context for simulated predictions only.

The final product review is documented in [ETHICAL_DESIGN_AUDIT.md](ETHICAL_DESIGN_AUDIT.md).

## Sports data foundation

The app uses provider-neutral TypeScript models for leagues, teams, players, games, markets, predictions, and results. A provider adapter normalizes external responses before they reach the interface, and a clearly labeled mock provider remains available whenever live data is unavailable.

Copy `.env.example` to a local `.env` file when configuring a server-side provider. `THE_ODDS_API_KEY` must remain server-side and must never be renamed with a `NEXT_PUBLIC_` prefix.

- `SPORTS_DATA_PROVIDER=mock` uses sample data.
- `SPORTS_DATA_PROVIDER=the-odds-api` selects the live adapter and requires `THE_ODDS_API_KEY`.
- Cache-window settings in `.env.example` control server freshness metadata. Genuine live games refresh every 40 seconds; sample and non-live views do not poll.

## Prediction history

Locked sports predictions use an anonymous device identifier and are stored in Cloudflare D1 when the hosted database binding is available. No name, email address, payment information, or sportsbook account is collected. A clearly labeled device-only fallback keeps the prototype usable when the database is unavailable.

Eligible winner, spread, and total predictions settle from final game scores. Behavioral insights require at least three settled predictions in each comparison group; smaller qualifying samples are labeled as possible patterns.

## Local development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm run dev
```

## GitHub Pages

The deployable static site is committed in `docs/` and published from the `gh-pages` branch. The live prototype is available at [annambacot-cpu.github.io/Clear-Pick](https://annambacot-cpu.github.io/Clear-Pick/).

### Real sports-data snapshots

The ready-to-activate `.github/refresh-sports-data.yml` setup keeps the provider key server-side, fetches only supported leagues that The Odds API currently marks active, builds sanitized game and market snapshots, and republishes GitHub Pages. Once placed in `.github/workflows/`, it runs daily to protect provider quota and can also be started manually.

Activate the setup by moving it to `.github/workflows/refresh-sports-data.yml` in GitHub, add a repository Actions secret named `THE_ODDS_API_KEY`, then run **Actions → Refresh real sports data → Run workflow**. The published interface labels these results as provider snapshots rather than real-time data. If a snapshot is unavailable, ClearPick falls back to its clearly labeled sample board.

## Prototype status

Scores and insights are illustrative rules for concept testing. They are not clinically or scientifically validated assessments.
