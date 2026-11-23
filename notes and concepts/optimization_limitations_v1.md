# Optimization limitations v1

Known limits of the v1 optimizer (`demand_estimation_v1.md` §9). Improvements: `optimization_ideas.md`.

- **The v1 optimizer is primitive.** It picks sites greedily by predicted point-hours within each class's € budget, skipping candidates that lie within a minimum distance of an earlier pick. It gives no optimality guarantee, ignores cost efficiency, treats the spacing distance as a judgement call, and has no validation of its own. It will be improved once the demand estimation model is working and in place.
