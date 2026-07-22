# ClearPick

ClearPick is a sports prediction and decision-training prototype. It lets users make simulated picks without real money, then evaluates both the outcome and the quality of the decision process.

The prototype includes:

- simulated matchup predictions;
- confidence and evidence tracking;
- quick emotional-state and decision-speed checks;
- reflection prompts when confidence outruns evidence;
- a process-weighted Decision Score;
- decision replay after a result; and
- early behavioral insights and calibration patterns.

ClearPick deliberately avoids odds, wagering, casino imagery, artificial urgency, near-miss effects, compulsive streak pressure, and loss-framed engagement.

## Local development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm run dev
```

## GitHub Pages

The deployable static site is committed in `docs/`.

In the repository settings, choose **Pages → Build and deployment → Deploy from a branch**, then select **main** and **/docs**. GitHub will publish the site at the repository’s Pages URL.

## Prototype status

Scores and insights are illustrative rules for concept testing. They are not clinically or scientifically validated assessments.
