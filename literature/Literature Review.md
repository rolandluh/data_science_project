# **StandortTOOL**

### **Categorizations used:**

* Public parking:  
  * Charging hubs (place dedicated specifically to charge on the Autobahn or elsewhere)  
  * Supermarkets  
  * Street-side  
  * Company parking  
  * Residential parking  
* Long-distance travel  
  * Travel above 100km conducted primarily on Autobahnen  
  * Demand assigned to Raststationen and Interchanges  
    * Points on the map, *not a grid*  
* Short-distance travel  
  * Under 100 km, conducted everywhere  
  * Demand assigned to the grid  
    * Each grid a sum of en-route-demand \+ opportunity-charging-demand  
* En-route charging  
  * Interrupting a trip purposefully to charge  
  * Taking place at charging hubs  
* Opportunity charging  
  * Charging once you reach a destination at the parking lot  
  * Taking place primarily supermarket, street-side, company, residential

### **Methods used**

* **Basis of it all:** National Baseline Charging Needs (kW / kWh):

  * Directly imported as macro-level inputs from external national simulation studies (NOW GmbH, 2024).  
* **Static Trip Generation Model** (Verkehrserzeugungsmodell)

  * Used to estimate **Opportunity Charging (Short-Distance)**  
    * **Why this method \-** behavior of drivers not relevant, just their destinations  
      * Destinations determined by static land-use data  
  * Disaggregates national demand down to 500m x 500m grid cells using land-use data (Zensus population, infas employee counts by sector, and parking availability factors).  
  * Does NOT use road networks or traffic density.  
* **Traffic Assignment Simulations** (Verkehrsumlegung using PTV Visum)

  * Used to estimate \**En-Route Charging (Long and Short-Distance)*  
    * **Why this method \-** behavior of drivers relevant, they stop when they have to charge  
  * Disaggregates national demand along road networks (Autobahnen and major thoroughfares) based on physical traffic density (DTV).  
  * Simulates vehicle routes, traffic congestion, battery consumption over distance, and specific mid-trip charging stops within a 15% to 5% Battery window.

| Metric / Dimension | Opportunity Charging | En-Route Charging |
| ----- | ----- | ----- |
| **Primary Driver** | **Land Use & Demographics** | **Network Flow** |
| **Driver Objective** | Perform an activity (work, shop, sleep) while the car is parked anyway. | Re-fuel/charge the vehicle to complete an ongoing journey. |
| **Spatial Anchor** | 500x500m Grid Cell | Road Network Segments / Service Stations / Autobahn Exits. |
| **Mathematical Logic** | **Static Multipliers:** Population X Employee attraction X Parking availability factors. | **Algorithmic Simulation:** Origin-Destination matrix routing X SoC depletion over distance. |

### **Spillover effects**

* When regions (grid cell or Raststatt) have negative charging demand (charging surplus), their surplus reduces demand in nearby regions  
  * In other, a driver just drives to the nearby region that has charging surplus when he cannot charge in his current region  
* Carefully calculated and applied (usually weighed by distance and DTV)  
* Factors like charging price, POIs, and cross-Kreis movement not considered

## **Limitations**

* No POIs:  
  * They potentially don't need to. Their simulations are probably accurate enough without them.  
* No actual empirical demand data, just simulations

### **Summary**

* Target audience: local governments and officials  
* Base their recommendations on forecasts of charging needs up until the year 2040  
* Much more complex models based on scientific, academic work  
* Part of a bigger ecosystem: FlächenTOOL allows people to register their surfaces to be used for the building of new charging stations  
  * Still in adoption  
* 500m grid (for short-distance commute estimations)  
* Continuous values: demand measured in kw and kwh  
  * Ours would probably be discretely

## **Our potential contribution**

* Estimation based on empirical occupancy data  
  * Can also focus on capacity pressure \- where are the charging stations overused  
* Focus on a business audience  
* A more smooth user experience  
* Regularly updated and granular, in-depth for BW  
* Optimization based on spatial and budget constraints  
* Additions of actual candidate locations  
  * Parking, Supermarkets, Unis, Hospitals from OpenStreetView  
* POI integration into the algorithm

# **Hecht et al. (2024)** **Forecasting placement on empirical German data with Neural Networks**

* They rate the "attractiveness" of a point on a GLOBAL map by user input

### **Data**

* Some private dataset, 2019-2023, 2939 CS (charging stations)  
* May be available for download, but is obviously a non-random sample

### **Methods**

* Multilayer perceptron (the simplest NN)  
* OLS regression (insanely violated assumptions)

### **Limitations**

* Their recommendation algorithm does NOT consider surrounding CS  
* Their model ONLY considers POIs  
* Their dataset definitely has some selection bias: not all big providers are listed  
* Only consider CSs built before 2019

### **Weekx et al. (2025) – Brussels Charging Demand Model**

### **Their analysis of the literature**

* Data Mining / ML approaches show great potential according to their estimates  
  * Nice thing: validation possible  
  * **Problem:** temporal dimension neglected  
* Simulation-based approaches (like NOW)  
  * Great temporal and spatial dimensions  
  * Problem: unvalidated  
    * **Idea:** We could validate NOW's predictions with our empirical data  
    * Or perhaps enhance somehow 🤔  
* Prediction models must have:  
  * A sufficient spatial dimension (obviously)  
  * Temporal dimension (because CSs are long-term investment)  
    * **Idea:** could potentially be assumed away \- EV adoption is in its infancy  
      * Can be justified by the sigmoid adoption curve or whatever, some business study  
  * A way to validate

## **Methodology**

* #### Aggregation / Disaggregation: weighted mean

* #### Preprocessing:

  * #### *"Variables with extreme outliers are truncated, while skewed distributions are log transformed"*

  * #### Low/high charging times ommitted

  * #### Excessive voltages removed

#### **Design choices**

* **Spatial Dimension ($S$) – 4 Levels of aggregation:**  
  * **District** / **Kreis**: Mean of all stations in the district.  
  * **500m surface area**  
  * **Building block** ($0.01k{m}^{2}$, 5,557 blocks): Station linked to the closest block.  
* **Temporal Dimension ($T$) – 3 Train/Test Splits:**  
  * 2021–2022 (Train 2021 $\rightarrow$ Test 2022\)  
  * 2022–2023 (Train 2022 $\rightarrow$ Test 2023\)  
  * 2021–2023 (Train 2021 $\rightarrow$ Test 2023, testing a 2-year gap)  
  * *Rule:* Only includes stations operating for all 365 days of a given year.  
* **Metric Dimension ($M$) – 4 Demand Metrics:**  
  * **Duration:** Total hours plugged in.  
    * **What we can use.**  
  * **Energy:** Total kWh consumed.  
    * Unavailable for us  
  * **Sessions:** Total count of charging events.  
    * **What we can use.**  
  * **Users:** Count of unique drivers (via unique RFID cards).  
    * **What we can use.**

#### **Methods Used**

* **Algorithm:** **Random Forest (RF) Classifier**  
  * Builds an ensemble of decision trees (tuned between 10 and 250 trees using 5-fold cross-validation).  
  * Entire training/testing loop repeated **50 times** to remove sampling bias and measure confidence.  
* **Why Random Forest Classification ("Top 20%") instead of predicting exact numbers?**  
  * **Low accuracy of exact numbers:** Past studies show predicting exact kWh or utilization performs poorly in early EV adoption phases.  
  * **Location vs. Sizing:** To pick a location, planners only need to separate high-demand areas from low-demand areas.  
  * **Small dataset:** Classification handles small training sets (relative to 18 input variables) much better than regression.  
  * **Future-proofing:** Total kWh grows rapidly every year as EVs increase; predicting a relative **Top 20%** ranking stays stable over time.  
* **$X$ Variables (18 Spatial Predictors):**  
  * **Land-use:** Population density, on-street parking demand (day & night), off-street parking, residential area %, CBD area %, POI count (from OpenStreetMap).  
  * **Socio-economic:** Median income, higher education %, house owners %, household size, males %, foreigners %, median age, total population.  
  * **Mobility:** Salary cars, incoming commuters, incoming movements (cell phone trip data).  
  * **Spatial Mapping:** Uses *weighted sum* (for counts), *weighted mean* (for averages/percentages), and *count points* (for POIs) to fit all 18 variables onto whichever zoom level is being tested.  
* **$Y$ Variable (Target Output):**  
  * Binary class probability: Whether a spatial area belongs to the **Top 20%** busiest locations for a given metric ($M$).

### **Results**

- Charging duration performs among worst  
  - But is theoretically the most valid one for prediction   
- Shorter time periods make better predictions  
  - Means retraining is essential  
- Grid size doesn’t play much of a role

### **Limitations**

* No consideration of competition  
  * Maybe because of endogeneity; they don't address it though  
* 2021 data affected by COVID 19  
* The results ONLY relate to short-distance travel

## **Our contributions**

- We can also try XGBoost, Neural Networks  
- We can further validate the models with the NOW data  
- We can combine the ML model predictions with NOW data  
- We can combine ML models with spatial coverage models

