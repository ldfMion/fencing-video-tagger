# Failure classification model

The app uses a two-axis model for touches received: **what failed** and, optionally, **why it failed**. “Failure” is intentionally broader and less judgmental than “mistake”; a deliberate experiment can fail without having been an unreasonable decision.

## Failure mode: what went wrong

Choose one mode using a counterfactual test: hold the other factors constant and ask which single change would most directly have made the action work.

| Mode | Definition |
| --- | --- |
| Technique | The action, distance, and timing were appropriate, but the physical mechanics failed. |
| Distance | The same action could have worked from a different measure. |
| Timing | The same action could have worked at a different moment. |
| Action choice | The action remained unsuitable even with appropriate distance and timing. |

The modes are mutually exclusive. When several things look imperfect, classify the decisive failure rather than every visible flaw.

The technique/action-choice boundary depends on current capability. If the chosen action was one the fencer can normally perform in that situation and its mechanics broke down, use **Technique**. If the plan depended on an ability the fencer does not currently possess reliably, use **Action choice**; training may later remove that constraint.

## Cause: why it happened

Cause is optional and is only available after a failure mode is selected.

| Cause | Definition |
| --- | --- |
| Read | I attended to the situation but misperceived or misinterpreted a relevant cue. |
| Knowledge gap | I lacked the tactical understanding needed to identify the appropriate response. |
| Experiment | I deliberately tested a plausible but uncertain option. |
| Discipline | The correct response was consciously available, but I acted against it. |
| Lapse | I temporarily failed to apply knowledge, attention, or ability that is normally available. |
| Skill gap | The required ability is not yet reliable under comparable conditions. |

**Discipline** means the correct response was present in the moment and was overridden. **Lapse** means it was normally available but temporarily failed to become or remain available. For example, knowingly counterattacking despite an active intention not to is Discipline; reverting automatically without recalling that intention in the moment is Lapse.

Fatigue, pressure, surprise, and distraction are not classifications in this model. They are possible causes of the diagnostic cause and can be captured in the comment when useful.

## Examples

- An attack is parried because it began too far away: **Distance**. If it is repeated after the distance problem was consciously recognized, the second failure can be **Distance + Discipline**.
- An early-bout option is deliberately tried and proves unsuitable against the opponent: **Action choice + Experiment**.
- A normally reliable action is selected in the right measure and moment, but the hand mechanics fail during a brief loss of focus: **Technique + Lapse**.
- A cue is watched but interpreted incorrectly, leading to the wrong response: **Action choice + Read**.

## Data versioning

Classification is versioned per bout.

- **Version 1** is the legacy model: Tactical or Execution.
- **Version 2** is the two-axis model above.
- A stored bout without `failureClassificationVersion` is interpreted as Version 1.
- Newly created bouts explicitly store Version 2.
- Version 1 and Version 2 values are never mapped onto each other. Old bouts keep their original classification and UI.
- JSON and CSV exports include the bout's classification version. Search exposes Version 2 mode/cause filters and a separate legacy-classification filter.

Only touches received by the user are intended to be classified. This is a usage convention rather than a data validation rule, because the app does not maintain a durable identity for “me” across every bout.
