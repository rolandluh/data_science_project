### **Glossary**

* CS \- Charging Stations  
* **A** \- demand prediction  
* **B** \- placement optimization based on demand

## **Input**

* k many CS to build  
  * Simple formula: Budget // Price-of-CS-Type  
  * Price-of-CS-Type \- Scraped, averaged, update on monthly basis  
  * We can start off by having just k as input

## **Issues to be vary of**

- Differentiating between long-distance and short-distance roads  
  - CS density in a city and on an autobahn are two very different things  
  - The selection algorithm needs to take that into account  
- Differentiating between private and public parking  
- Differentiating between power output capabilities of CSs

# **Level 0: Pure simplicity**

All in all, good start \+ a benchmark

* **A0 Demand grid**: fill the 500m grid with estimated demand  
  * Demand: EV-share x Population  
  * Superimpose existing charging stations  
  * **IMPLEMENTED**   
    * **All charging points count the same; an 11 kW point and a 150 kW point both count as one**  
    * **Do we count charging stations or charging points (there can be e.g. 2 charging points per station)**   
    * **When gap is higher in more remote parts of cities, how we want to deal with that? (It says: demand is high but we see that its a remote part of town) \-\> added data about Mieter/Hausbesitzer(not verified manually) and made it weightbased**  
    * **Haven’t thought about what to do with autobahnen/rasthöfe etc because that demand has to be inferred from traffic data not from population**  
    * **Supermarket and Parking proximity check, else dont include specific supermarket since there is nowhere to put CS**

* \*\*B0 Greedy maximum coverage search  
  * Classify a radius R around existing CS as covered  
  * maximize Σ demand × covered subject to at most k new sites  
* **C Evaluation**  
  * tbd

# **Level 1: Best algorithms**

No ML, nothing fancy, methodological perfection

* **B1: Exact optimization**  
  * Don't use greedy, heuristic algorithms, but mathematical optimization  
  * Open-source, common practice models: HiGHS solver or OR-Tools or PuLP.  
* **A1: Better Demand estimation:**  
  * Add weights to the demand model: house/apartment population density, proximity to points of interest, other important factors from literature

# **Level 2: ML**

* **B2:**  
  * **tbd**  
  * complex, spatial search models that take competition and road-distance into account  
    * Needs more research on our part  
* **A2: ML-predicted demand**  
  * Models like Gradient Boosting, XGBoost  
  * Features: A1 components (population, EV density, home-charging gap, POIs, road class, traffic), plus station attributes (AC/DC, power, number of points, operator type) and local context (distance to the nearest other station, density of competing points within a radius)  
  * Potentially a lot of limitations: endogeneity, selection bias  
  * **Automation:** Models need to be retrained every quarter (or other period) to remain predictive in the future (Weekx et al., 2025\)  
    * *How?*  
  * **Missing variables:** income, education, proximity to houses or apartments  
  * We could run several models under several configurations and pick the best  
  * Could be validated against NOW results  
  * **Idea:** add a “coverage” component too rather than just  
- **A2.1: replicating/scraping/obtaining simulation-based demand estimates from NOW**  
- **A2.2: Hybrid approach**  
  - Combine the two demand predictions in some way  
  - Weighted average: weigh the current demand (ML derived) by the future demand prediction (Simulation demand from NOW)

