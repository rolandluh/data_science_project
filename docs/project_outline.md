# 1 Introduction

All students in the master program M.Sc. Data Science in Business and Economics enrol in an implementation-focussed module Data Science Project. With 12 ECTS, the project has a substantial weight in the curriculum. This is also reflected in our expectation that students show a high degree of independence in their work in this module. Students work together in groups of 2-4 persons.

The basic idea of this module is that students independently design and program the entire process of a data science project from start to finish.

This requirement places a focus on automation, which means that the procurement of data, the structuring, reading, validation, modification, and analysis take place (as far as possible) without the intervention of the analyst or user of the analysis.

A data science project should include the following components:

1. Data acquisition: The project acquires and reads in the data, for example, by scraping data from web pages, by using APIs, or by reading text documents, images, or video data. It is also possible for students to create a new dataset semi-manually themselves or to use an existing dataset as the basis for the project. The complexity and the effort of the data acquisition are considered in the grading of the project.
2. Data preparation and validation: The data are read in and made ready for further analysis, computation, and/or estimation. Among other things, this means that unstructured data (e.g., texts) are converted into computable formats and that different data sources are combined meaningfully. The data should be validated, for example, by generating descriptive statistics and figures as well as by identifying implausible observations and outliers. After having defined the criteria for validation, this process should also take place mainly without the users’ intervention.
3. Data analysis: The primary focus of the project is a relevant substantive question, which can, but does not necessarily have to be of an economic nature. The corresponding analysis should be implemented with adequate methods (traditional statistics or machine learning).
4. Validation of the results: It is crucial to validate the results of the analysis by suitable approaches. This is to make sure that the results from your analysis are helpful and practically relevant.
5. Presentation of the results: All project outputs (e.g., tables, graphs, results) should be embedded in an interactive environment, for example, in the form of a webapp. Results should be presented in an appealing and informative way, according to the state-of-the-art of data visualization.
6. Automation: The entire project with the above-mentioned steps should run automatically. When new data periodically arrives, a user who did not create the code can evaluate and analyse it without having to “touch” the code.
7. Version control and collaboration: As soon as the topic, data sources, structure, and type of analysis are defined, the code, including the version history, must be organized in a GitHub repository.
8. Documentation: The whole project should be well-documented so that external parties can easily understand and review what is happening in your code and how different components of your architecture work together. This includes a meaningful structure of your repo (directory structure and file names) and comprehensibly commented code, among others. In addition, there should be a document that guides the reader through your repo (e.g., a README) that includes, for example, which files must be executed and in what order.

# 2 Difference between a master thesis and the Data Science Project

A master thesis focuses on solving a relevant research problem, which must be embedded in the relevant literature. The analyses are described in the text, and the results are printed in the form of static tables or graphs. The thesis then interprets the results and draws conclusions. There are no requirements for automation, and the reader “consumes” the text without interacting with the data themselves.

| Master thesis | Data Science Project |
| --- | --- |
| Elaborate research problem | High weight | Low weight |
| Literature work | High weight | Low weight |
| Automation | Low weight | Very high weight |
| Reader/user interacts with data | Low weight | Very high weight |
| Conclusion | Mostly author | Rather reader/user |

# 3 Evaluation/Grading

Students present their results (as a group) twice: In an interim presentation, they present the plan and first steps. In the final presentation, they show the completed project, the central structure of the code, the architecture behind their “product”, and how users can interact with the result.

The project is evaluated according to the following criteria:
1. Complexity of the problem
   a. How complex are the different components of the project?
   b. How novel is the problem and the proposed solution?
2. Quality of the execution
   a. How is the user experience of the final product?
   b. How well does the automation work? How well is the error-handling?
   c. Is the implementation logically consistent?
   d. Are the product/results appropriately validated?
3. Quality of the documentation
   a. Are the project architecture and code structure easily understandable?
   b. Is the code easily readable by an external party?

For assessment, students will produce the following components:
1. A presentation that motivates the central question, derives its relevance, and refers to relevant literature as appropriate. Furthermore, students present their project’s architecture and technical implementation as well as the finished “product”, e.g., a website/dashboard or a comparable way to interact with the data as a user. The presentation also contains a discussion in which supervisors and other students ask questions.
2. A verbal summary (max. 3 sentences) of their Data Science Project.
3. A short video (approx. 3 minutes) that clearly presents the project and the result to a broader circle of users. The video can be a screencast where only the presenter's voice is heard while the final product is shown, or it can be a video presentation in which the presenters are also visible. The target group is a non-technical audience; e.g., in a business context, it would be a manager, not a fellow data scientist.
4. Students provide the code by granting the supervisors access to the GitHub repository or by providing a link to the repository if it is public.
5. Since the dataset might be very large, there is no need to upload it to GitHub or ILIAS. However, be prepared to grant supervisors access, e.g., by a dedicated database user.
6. The interface (e.g., webapp) must be available to other students and teachers, e.g., by hosting it on the bwCloud.

Evaluation is done at the individual level, not at the group level. Thus, the group members’ contributions to the project and presentations will be considered in the evaluation.

All components except for the presentation slides must be submitted one week prior to the final presentation (see schedule below).


## OUR TOPIC
# TOPIC 12:
# Optimizing the Placement of Electric Vehicle Charging Stations  

Determine where new electric vehicle charging stations should be installed to maximize 
accessibility, utilization, and geographical coverage. 
Analyze existing charging infrastructure, population distribution, road networks, points of 
interest, and potential demand for electric vehicles. Recommend optimal charging station 
locations under budget and infrastructure constraints, and evaluate different deployment 
strategies. 

## Analysis Methods

### Spatial Analysis
- **Gap analysis:** Overlay charger density vs demand proxies (population density, EV share) per district/municipality to identify underserved areas
- **Clustering:** DBSCAN or k-means on charger locations to identify coverage clusters and spatial gaps
- **Spatial autocorrelation:** Moran's I to test whether charger placement correlates with demand or is spatially random

### Scoring & Utilization
- **Weighted scoring model:** Rank candidate locations (e.g. parking sites without nearby chargers) by population density + EV share + distance to nearest charger — simple, explainable, good for a first pass
- **Historic utilization analysis:** Use MobiData BW availability snapshots to identify high-demand stations (low availability = high usage), then characterize what makes those locations attractive

All methods use scikit-learn, geopandas, and scipy (already in the project stack). Results feed into the Leaflet map as a recommendation layer.

## Project Roadmap

| Phase | Status | Details |
|-------|--------|---------|
| Data collection | Done | 6 sources, automated pipeline (`extract.py`), 33 GB raw → 44 MB processed |
| Data quality / EDA | Done | Completeness matrix, outlier detection, cross-dataset consistency, spatial sanity checks |
| Feature engineering | Next | Demand score per grid cell, coverage gap metrics, utilization features from historic data |
| Model / scoring | Next | Weighted placement model, clustering, spatial autocorrelation analysis |
| Map visualization | In progress | Leaflet map with data layers live; needs model output / recommendation layer |
| Validation | Planned | Compare recommendations against recent 2025–2026 installations as ground truth |
| Report & presentation | Planned | Final deliverable: interactive webapp, video, documentation |

 