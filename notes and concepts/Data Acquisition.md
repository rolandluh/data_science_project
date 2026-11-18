# Data Sources

# 100% Chosen Data Sources

- **Ladesäulen register api**  
  - Includes positioning of existing stations  
  - 95% of charging stations in Germany covered  
  - Obtained (Downloaded)  
- **Zensus 2022 API**  
  - Population, 1km grid  
  - API key: <ZENSUS_API_KEY>  
  - Obtained (Downloaded)  
- **Charging usage data**  
  - To be determined after meeting with Aseem  
  - Obtained (Downloaded)  
- **Number of EVs**  
  - Estimate using Population 1km grid \+ FZ 5-km grid  
  - More granular and better, but we need to figure out a good way of estimating  
  - [API](https://services-eu1.arcgis.com/U09msXRZoxesNntH/arcgis/rest/services/FZ_Pkw_mit_Elektro_Antrieb_Regionen_Gitterzellen2024/FeatureServer/0/query)  
  - Obtained (Downloaded)  
- **OpenStreetView**  
  - For road access and parking and front end  
    - **Problem:** differentiating between private and public parking  
  - Obtained (Downloaded)

# Additional Chosen Data Sources for BaWü

- **Traffic data api**  
  - [**Link**](https://mobidata-bw.de/dataset/?groups=verkehrszaehldaten)  
  - Hourly data  
  - A set number of measuring stations  
    - Need to figure out how to integrate into our 5km grid  
- **Historical Charging Station Usage Data MobiDataBW**  ([Link](https://mobidata-bw.de/de/dataset/e-ladesaulen))  
  - Updated every 10 minutes  
  - Discrete charging indicator  
    - **Potential issue:** does an “occupied” charging station mean the charger is occupied or just the parking spot is occupied  
  - Can be aggregated higher onto days, months  
  - Covers about ⅓ of the total number of Charging Stations in BaWü  
    - Not truly a randomized sample  
    - Can be probably quazi-tested if it’s   
  - Polling drops after W32  
    - For all providers, randomness remains the same  
    - Obtained (Downloaded)  
- **Parking spot data specifically for BaWü**  
  - Obtained (Downloaded)  
- Historic Charging data from Hecht et al (2024)  
  - INVESTIGATE AVAILABILITY

**\-	Medianentgelt (From Arbeitsagentur)**                source:[https\://statistik.arbeitsagentur.de/DE/Navigation/Statistiken/Interaktive-Statistiken/Entgelte-regional/Entgelte-regional-Nav.html](https://statistik.arbeitsagentur.de/DE/Navigation/Statistiken/Interaktive-Statistiken/Entgelte-regional/Entgelte-regional-Nav.html)  
\- for the complete country population and u have to use GitterID(it encodes the location) to map only for the Badenwüttenberg

# Future additions

- Power grid data  
- When clicking on any point on map we need to have a check if its possible to put a ev station there. E.g. Click on random street \-\> error, click on parking \-\> possible, click on private property \-\> popup that its private and need permission, click on supermarket \-\> dont know what should happen here

# 

# Marko Research

* [Federal Data on the Charging Infrastructure](https://bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenkarte/start.html)  
  * Con: Doesn't show all data  
    * Non-charging stations (offerings by hotels, etc.) not present  
      * Is irrelevant anyway  
    * Small scale stations (private individuals) can choose not to give geoinfo  
      * According to Gemini, some 3-5% of all stations in Germany  
* Charging Infrastructure use  
  * No readily available public data  
  * BUT: we can collect the data from a live feed of charging station availability through an API provided by the government (called **Mobilithek**, see [here](https://github.com/MobilithekDE/AFIR-DATEX-II-Recharging-Profil/tree/main/Releases/Version%2001-00-00))  
    * They don't provide historical data, just real-time charging station availability data  
    * BUT WE CAN COLLECT IT  
    * This way we even have data collection in the project  
    * Again, according to Gemini  
    * Can also be skipped or left for later  
* Electrical grid  
  * Public data showing the location of electrical grids  
  * Even some sources showing capacities of grids (though incomplete)  
  * We can just assume all grids are equally available and state it clearly  
* Electric vehicle ownership  
  * Public data on 5km grid cells  
    * Incldues shares only\! Needs to be estimated using municipal FZ data.  
    * Or just use municipal data, it has absolute values  
  * According to CGPT and Gemini  
* Population distribution  
  * Public data, 100m grid  
  * According to CGPT and Gemini  
  * 2022 Census data  
* Roads, amenities, parking  
  * OpenStreetMap  
  * According to CGPT and Gemini

