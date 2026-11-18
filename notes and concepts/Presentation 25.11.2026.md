*1\. Who is your user?*	  
*Describe the user you have in mind for your app or product. This can be one type of user or several, but you should have at least one clearly defined user. Tell us who they are and what problem or need they have.*

- Primary: charge point operators and investors **in Baden-Würtemberg**  
  - Charging Point Operators, utilities and energy companies planning new sites limited budget  
  - Limitations: budget, area  
  - Need: profit maximization → usage maximization → demand maximization  
- Secondary: Municipalities  
  - Need: accessibility maximization  
  - Secondary goal

*2\. How will they use it?*  
*Walk us through the expected use cases. What does this user want to do with your product, and in what situations would they use it?*

- **Example person**: Lena, CPO Expansion Manager in EnBW  
  - Is at the regional branch in Karlsruhe  
  - Her department has been assigned a budget  
- **Problems Lena faces:** must pick the best set of sites and defend the choice to her supervisors, but  
  - Cannot tell where there’s high charging demand  
    - Where there are more EVs in Karlsruhe and where less  
  - Cannot see where demand is met and where it isn’t  
    - She can only see where charging stations are in Karlsruhe, but not which are overused/underused  
  - Has no specific candidate sites  
    - She must check parking lots, supermarkets and other candidates by hand  
  - Has to decide on how many and what kind of CSs to build on each site  
  - Has to somehow estimate future returns on every recommendation  
- **What she needs from our app:**  
  - Choose an area (Gemeinde, Kreis, or a radius around a point)   
  - Choose a budget  
  - Get recommended sites new CS based on demand, access optimization, building availability, and existing supply  
  - Get the exact number and type of CSs to build at each site  
  - Get information on what estimates these analytics are based on

*3\. What are you building to support those use cases?*  
*Explain how your product, including your data, models and app, supports these use cases. Make the connection between the user's needs and what you are building clear.*

* **Overview:** a pipeline, ML Model plus a web map that turns open data into a budget-constrained site recommendation. Each step answers one of Lena’s problems.  
* **Data (where is demand, what exists today)**  
  * Supply: Bundesnetzagentur register (18,863 BW stations) and live status from MobiData BW  
  * Demand drivers: Zensus 2022 population on a 500 m grid, KBA EV share, BA income, land use data, MobiData BW  
    * Observed use: historic usage data of charging stations in BaWu  
  * Candidate sites: about 140k parking sites (OSM \+ MobiData), plus supermarkets, hospitals and universities from OSM, substations as a grid-connection proxy  
  * Spatial context: motorways and junctions (OSM)  
  * Building costs sourced and pulled online  
  * **Limits of the data:**  
    * Observed usage covers only about a third of BW stations and favours larger networks, so it is not a random sample  
    * Observed usage is an imperfect, censored proxy for true demand: it exists only where stations already stand (Weekx et al., 2025)  
    * Demand drivers (EV share, income) are published on coarse 1–5 km cells and spread evenly over the 500 m cells  
    * Private and public parking are hard to tell apart in OSM  
    * We have no revenue data, so “returns” rest on stated assumptions  
  * *Visual prompt for the data slide (for the slide generator):* one left-to-right diagram, four columns. Column 1, “Sources”: Bundesnetzagentur charger register, MobiData BW (live status and history), Zensus 2022, KBA EV share, BA income, OpenStreetMap (parking, POIs, roads, substations), BKG boundaries. Column 2, “Pipeline”: one box, “automated download, cleaning and validation”. Column 3, “Prepared layers”: 500 m demand grid, existing supply, observed occupancy per station, candidate sites. Column 4, “Output”: demand gap, ranked sites, web map. Mark the occupancy source with a small “covers ~1/3 of stations” note. Use a clean flat style with one accent colour and few words per box.  
* **Demand (Lena: “where is demand?”)**  
  * **Machine Learning approach:** Random Forest classifier trained on observed occupancy, following Weekx et al. (2025)  
    * Discrete estimator: predicts whether an area is in the “top 20% demand” rather than exact values, which suits small, biased data  
    * Features: population, EV share, home-charging gap, points of interest, road class, traffic, and distance to existing stations  
    * Retrained periodically, because their paper shows predictions hold only about 1–2 years  
* **Site selection (Lena: “which sites?”)**  
  * Spatial optimization (HiGHS, OR-Tools or PuLP)  
  * Chooses sites based on candidate points  
  * Based on road infrastructure  
  * Considers existing supply  
  * Considers points of interest  
* **Validation (Lena: “can I defend this?”)**  
  * Time split: do recommendations match stations commissioned in 2025–26?  
  * Compare our predictions with the data from site-recommendation forums  
    * Still not collected   
  * Compare with demand estimation from StandortTOOL  
    * A simulation-based estimator  
    * Still not collected  
* **App (what Lena sees)**  
  * Pick region and budget, see demand gap and over/underused stations  
  * Ranked sites with expected utilisation and uncertainty, and the assumptions behind each score  
* **Automation and documentation**  
  * One pipeline entry point that downloads, validates and rebuilds on new data  
  * Versioned in GitHub, README with run order, architecture and limitations

**At the end: brief showcase of current stage of progress. Build a stripped version of the current webapp that’s supposed to demonstrate what the final product looks like. That means the stripped down version doesn’t have all of the many buttons that are relevant for us as developers.**  
