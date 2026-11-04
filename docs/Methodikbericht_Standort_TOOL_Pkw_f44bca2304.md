

## [HIER EINGEBEN]




















Methodikbericht StandortTOOL
## Pkw





## DOKUMENTENVERSION 1.0.2






## 1



## Inhalt
Abbildungsverzeichnis ....................................................................... 2
Tabellenverzeichnis ............................................................................ 3
Abkürzungsverzeichnis ....................................................................... 4
1 Einleitung .................................................................................. 5
1.1 Motivation ..................................................................................................... 5
1.2 Übersicht ...................................................................................................... 6
2 Datengrundlage ......................................................................... 7
2.1 Ladeinfrastruktur nach 2025/2030: .................................................................. 7
2.2 Mobilität in Deutschland (MiD) ........................................................................ 8
2.3 Ergebnisse der Cleanroom-Gespräche Pkw...................................................... 9
2.4 Zählstellen und Rastanlagen-Erfassungstool (BASt) .........................................10
2.5 Verkehrsprognose 2040 .................................................................................10
2.6 Erwerbstätige Personen am Arbeitsort und Einwohner .....................................10
3 Module .................................................................................... 12
3.1 Markthochlaufprognose ................................................................................12
3.2 Verkehrsmodule ............................................................................................13
3.2.1 Fernverkehr ..................................................................................................14
3.2.2 Nahverkehr ...................................................................................................21
3.3 Berücksichtigung von Bestandsladeinfrastruktur .............................................27
3.3.1 Fernverkehr ..................................................................................................28
3.3.2 Nahverkehr ...................................................................................................29
4 Zusammenfassung .................................................................. 32
5 Literaturverzeichnis ................................................................. 33
6 Anhang .................................................................................... 35
6.1 Szenarien .....................................................................................................35
6.2 Stellplatzverfügbarkeit ...................................................................................36
6.3 Isochronen ...................................................................................................36
6.4 Deckelung der Ladeleistung ...........................................................................39

## DOKUMENTENVERSION 1.0.2






## 2




## Abbildungsverzeichnis
Abbildung 1: Unterschiedliche Anwendungsfälle („Lade-Use-Cases“) für E-Pkw ........... 8
Abbildung 2: Beispiel des Ladefensters .....................................................................19
Abbildung 3: Schema Methodik Nahverkehr ..............................................................22
Abbildung 4: Schema Hausblockzelle im Verkehrserzeugungsmodul ..........................23
Abbildung 5: Umverteilung unerreichbarer Ladebedarfe .............................................26
Abbildung 6: Schema Bestandsumverteilung im Fernverkehr ......................................28
Abbildung 7: Beispiel Ausstrahlungen der Bestandsladeinfrastruktur ..........................30
Abbildung 8: Aufsplittung der Geogitter .....................................................................37



## DOKUMENTENVERSION 1.0.2






## 3



## Tabellenverzeichnis
Tabelle 1: Gruppierung der Wegezweck aus der MiD .................................................... 9
Tabelle 2: Kalibrierungsgüte je Verkehrsstärkenklasse ................................................16
Tabelle 3: Zuordnung der Fahrzeugsegmente aus der KBA ..........................................18
Tabelle 4: Gewichte für die Zuweisung zu Anschlussstellen und Rastanlagen...............20
Tabelle 5: Beispielhafter Ausschnitt der Ausstrahlungstabelle (Nahverkehr) .................30
Tabelle 6: Stellplatzfaktor je Raumtyp am Zielort ........................................................36
Tabelle 7: Wege-Anteile 푊 .......................................................................................37
Tabelle 8: Ausstrahlungsfaktoren ..............................................................................38



## DOKUMENTENVERSION 1.0.2






## 4



## Abkürzungsverzeichnis
## Abkürzung Bedeutung
AFIR Alternative Fuels Infrastructure Regulation
ARS Amtliche Regionalschlüssel
BASt Bundesanstalt für Straßen- und Verkehrswesen
BEV Batterieelektrisches Fahrzeug
BKG Bundesamt für Kartographie und Geodäsie
BMV Bundesministerium für Verkehr (vorher: BMDV bzw. BMVI)
CPO Charge Point Operator
DLM Digitales Landschaftsmodell
CR-Funktionen Kapazitätsbeschränkungsfunktionen (capacity restraint functions)
DTV Durchschnittlicher täglicher Verkehr
EV Electric Vehicle
GEH-Statistik Anpassungsgütemaß
HPC High Power Charging
Infas Institut für angewandte Sozialwissenschaft
KBA Kraftfahrtbundesamt
## Kfz Kraftfahrzeug
LIS Ladeinfrastruktur
LSR Ladesäulenregister
LSV Ladesäulenverordnung
MiD Mobilität in Deutschland
MIV Motorisierter Individualverkehr
NLP Normalladepunkt
PHEV Plug-in-Hybrid
## Pkw Personenkraftwagen
POI Point of Interest
RegioStaR Regionalstatistische Raumtypologie
SLP Schnellladepunkt
SOC Ladezustand der Batterie
VG25 Verwaltungsgebiete 1:25 000


## DOKUMENTENVERSION 1.0.2






## 5



## 1 Einleitung
## 1.1 Motivation
Bis zum Jahr 2045 soll Deutschland treibhausgasneutral sein, die Europäische Union (EU)
bis 2050. Zwar sind die Treibhausgasemissionen in Deutschland seit 1990 stark gesun-
ken, doch der Verkehrssektor trägt mit einem steigenden Anteil maßgeblich zur Belastung
bei: Lag dieser 1990 noch bei rund 13 %, betrug er im Jahr 2022 bereits knapp 20 %.
Hauptursachen sind der Anstieg des Straßengüterverkehrs und Motorisierten Individual-
verkehrs  (MIV)  in  Verbindung  mit  einem  zunehmenden  Absatz  von  Dieselkraftstoff
(Umweltbundesamt, 2024).
Ein zentraler Hebel zur Reduzierung der Emissionen im Verkehrssektor ist die Elektrifizie-
rung von Personenkraftwagen (Pkw) und leichten Nutzfahrzeugen(Hendzlik, 2024). Vo-
raussetzung dafür ist der vorausschauende Ausbau einer flächendeckenden, bedarfsge-
rechten und nutzerfreundlichen Ladeinfrastruktur. Diese stellt, in der Planung und Um-
setzung, eine Vielzahl von Akteuren – darunter Kommunen, Energieversorger, Charge
Point Operator (CPO) und Genehmigungsbehörden – vor komplexe Herausforderungen.
Insbesondere kommunale Akteure und Energieversorger benötigen verlässliche Progno-
sen darüber, wann an welchen Orten wie viel Ladeleistung bzw. verladene Energiemenge
zu erwarten ist. Ob an einem bestimmten Ort Normalladepunkte (NLP), Schnelllade-
punkte (SLP) oder High Power Charging (HPC) errichtet werden sollen und wie wirtschaft-
lich die Lademöglichkeit sein wird, hängt wiederum maßgeblich von lokalen Gegebenhei-
ten ab und kann nur vor Ort von kommunalen Akteuren bewertet werden.
Das  StandortTOOL (www.standorttool.de) der  Nationalen  Leitstelle  Ladeinfrastruktur
bietet hierfür eine nutzerorientierte Ladebedarfsprognose. Es zeigt räumlich und zeitlich
differenziert zukünftige öffentlich zugängliche Ladeinfrastruktur auf. Bedarfe im privaten
oder gewerblichen Bereich (z. B. an der heimischen Wallbox) werden nicht ermittelt. Die
Kombination aus Bestand und Bedarf sowie zusätzlichen Informationen zu Förder- und
Finanzierungsaktivitäten und zum Fahrzeughochlauf von batterieelektrischen Fahrzeu-
gen (BEV) und Plug-in-Hybriden (PHEV) erlaubt es, den Ausbauzustand nachzuvollziehen
und weitere Maßnahmen abzuleiten.
Ziel ist es, durch Prognosen kommunalen Entscheidungsträgern, Investoren sowie weite-
ren Akteuren Einblicke und Handlungsempfehlungen zu bieten, um das sich schnell ent-
wickelnde Umfeld von Ladeinfrastruktur besser einschätzen zu können.

## DOKUMENTENVERSION 1.0.2






## 6



## 1.2 Übersicht
Die Ladebedarfe im StandortTOOL basieren auf einem mehrstufigen Modellansatz, der
verschiedene Datenquellen und Methoden kombiniert, um den Bedarf an Ladeinfrastruk-
tur zu prognostizieren. Dazu gehören makroskopische Verkehrsmodelle, die auf Basis von
Verkehrserhebungen und -prognosen den Ladebedarf für verschiedene Szenarien be-
rechnen. Bedarfe im privaten oder gewerblichen Bereich (z. B. an der heimischen Wall-
box) werden dagegen nicht ermittelt.
Der Bericht beginnt mit einer Übersicht der verwendeten Daten in Kapitel 2, beschreibt
anschließend die verschiedenen Module in Kapitel 3 und endet mit einer Zusammenfas-
sung der Ergebnisse in Kapitel 4.


## DOKUMENTENVERSION 1.0.2






## 7



## 2 Datengrundlage
Die Datengrundlage des StandortTOOLs umfasst verschiedene Daten und Studien:
2.1 Ladeinfrastruktur nach 2025/2030:
Die kleinräumige Verortung des Ladebedarfs basiert auf den deutschlandweiten Ladebe-
darfen aus der Simulationsstudie (NOW GmbH, 2024). Diese Studie liefert für verschie-
dene Zeithorizonte und Lade-Use-Cases (siehe Abbildung 1) deutschlandweite Ladebe-
darfe in Form von zu installierender Ladeleistung (kW) und verladener Energiemenge (in
kWh). Die Ergebnisse sind aufgrund der Eingangsdaten nicht räumlich differenziert, d. h.
für einzelne Gemeinden liegen keine Einzelwerte vor.
Die Studie definiert fünf Szenarien, die unterschiedliche Rahmenbedingungen für den La-
deinfrastrukturausbau abbilden:
## 1. Referenzszenario
- Geringe Verfügbarkeit nicht öffentlich zugänglicher Ladepunkte
- Hohe Verfügbarkeit nicht öffentlich zugänglicher Ladepunkte
## 4. Digitale Optimierung
- HPC-Fokus
Diese Szenarien werden auch im Modell beibehalten und im StandortTOOL angezeigt.

## DOKUMENTENVERSION 1.0.2






## 8




## ABBILDUNG 1: UNTERSCHIEDLICHE ANWENDUNGSFÄLLE („LADE-USE-CASES“) FÜR E-PKW
Die Ladepunkte eines Schnellladehubs auf Parkplätzen vor Einkaufsmöglichkeiten kön-
nen nicht nur von Kundinnen und Kunden der Einrichtung, sondern auch vom durchfah-
renden Verkehr genutzt werden. In (NOW GmbH, 2024) finden rund 55,6 % der Ladevor-
gänge des Lade-Use-Case „Lade-Hubs“ auf Kundenparkplätzen und 44,4 % im Straßen-
raum statt. Der Anteil auf Kundenparkplätzen wird in unserem Modell wieder auf den
Lade-Use-Case „Kundenparkplatz“ zurückverteilt, um diese korrekt auf Parkplätzen ver-
orten zu können.
2.2 Mobilität in Deutschland (MiD)
Die Mobilität in Deutschland (MiD) bildet die Grundlage für die Modellierung des Ver-
kehrsverhaltens (BMDV, 2024). Aus diesen Daten stammen z. B. Erkenntnisse zu MIV-An-
teil, Besetzungsgrad der Fahrzeuge und Wegezwecke. Zur Kompatibilität mit der weiteren
Verarbeitung (Kapitel 3.2.2.1) werden die Wegezwecke aus der MiD in gröbere Einheiten
zusammengefasst (siehe Tabelle 1).





## DOKUMENTENVERSION 1.0.2






## 9







## TABELLE 1: GRUPPIERUNG DER WEGEZWECK AUS DER MID
MiD Modell
## Home Bewohnerverkehr
## Private
## Kundenverkehr
## Shopping
Work Beschäftigtenverkehr (z. B. von und zur Arbeit)
Leisure Gemeinbedarfs- und Freizeitverkehr (z. B. Besuch von sozialen und kulturellen Einrichtun-
gen)
Business Wirtschaftsverkehr (z. B. Dienstreisen oder Zulieferungen)
## School Schulverkehr

Es kann grundsätzlich davon ausgegangen werden, dass Wirtschaftsverkehr in Betrieben
mit hohen Zu- und Ablieferungen (z. B.  Speditionen) unterschätzt ist (Bosserhoff, 2006).
Freizeitverkehr ohne bestimmte Zielorte, beispielsweise beim Ausführen eines Hundes,
oder mit Zielen ohne Beschäftigte, beispielsweise Spielplätzen, wird in der Summe der
Freizeitwege berücksichtigt, kann aber möglicherweise nicht korrekt verortet werden.
2.3 Ergebnisse der Cleanroom-Gespräche Pkw
Für dieses Factsheet hat die NOW GmbH über mehrere Monate hinweg eine kartellrechts-
konform gestaltete vertrauliche Befragung von Fahrzeugherstellern geführt und hieraus
neben den Hochlaufzahlen planungsrelevante Fahrzeugspezifika wie Ladeleistung, Bat-
teriegröße und Energieverbrauch prognostisch ermittelt (NOW GmbH, 2026). Auf Basis
der übermittelten Daten wurde die Marktentwicklung hinsichtlich Absatz- und Bestands-
zahlen von E-Pkw (inkl. Plug-in-Hybride, PHEV) modelliert. Außerdem können Aussagen
zur Entwicklung der Batteriekapazität und des Energieverbrauchs vollelektrischer Pkw ge-
troffen werden.

## DOKUMENTENVERSION 1.0.2






## 10



2.4 Zählstellen und Rastanlagen-Erfassungstool (BASt)
Die Autobahn-Anschlussstellen entstammen dem „Bundesinformationssystem Straße“
(BISStra) der Bundesanstalt für Straßen- und Verkehrswesen (BASt).
Grundlage für die Rastanlagen ist das „Rastanlagen-Erfassungstool“ der BASt, zusam-
men mit der Autobahn GmbH. Diese werden anschließend mithilfe des Basis-DLM (BKG,
kein Datum) teilweise verbessert.
## 2.5 Verkehrsprognose 2040
In der Verkehrsprognose 2040 wurden die deutschlandweiten Verkehrsverflechtungen in
Form von Quelle-Ziel-Matrizen des Güter- und des Personenverkehrs für den Prognoseho-
rizont 2040 berechnet (Intraplan,  TTS  Trimode,  ETR,  MWP,  2024). Die  bereitgestellte
Quelle-Ziel-Matrix des Straßenverkehrs wird summiert über alle vorhandenen Wegezwe-
cke verwendet.
Bei der Quelle-Ziel-Matrix handelt es sich um eine Matrix für die jährliche Pkw-Nach-
frage zwischen Verkehrszellen
## 1
. Die Rohdaten enthalten die Verkehrsnachfrage vieler
Verkehrsträger (Schwerlastverkehr, Nahverkehr, Seeverkehr usw.), unterteilt nach Wege-
zwecken. Da es sich um eine tägliche Umlegung (Fahrzeuge/24h) handelt, wurde die
Pkw-Nachfrage (inklusive Beruf, Ausbildung, Einkauf, Geschäft, Urlaub und Privat) für
alle Wegezwecke addiert und im Anschluss durch 365 geteilt, um einen durchschnittli-
chen Tag zu erhalten.
2.6 Erwerbstätige Personen am Arbeitsort und Einwohner
Die Anzahl der Beschäftigten je Verkehrszelle, differenziert nach Wirtschaftszweigen des
Instituts für angewandte Sozialwissenschaft (infas), werden anhand soziodemographi-
scher Informationen sowie Firmenadressen berechnet und stimmen in Summe je Ge-
meinde und Wirtschaftszweig mit der amtlichen Statistik überein (infas, 2024).
Eine Limitation stellt daher der Aggregationsgrad der Branchen dar, da diese Gruppen un-
terschiedliches Verkehrsverhalten darstellen. Beispielsweise steht der bereitgestellten
Branche „Handel, Verkehr, Gastgewerbe, Information und Kommunikation“ die Modell-
branchen Restaurant und Hotel gegenüber, die in der Realität deutlich unterschiedliche
Anzahl Kunden je beschäftigter Person anziehen.

## 1
in Deutschland sind Verkehrszellen grob äquivalent zu Landkreisen.

## DOKUMENTENVERSION 1.0.2






## 11



Einwohnerdaten (Wohnbevölkerung) stammen aus dem Zensus, einer stichtagsbezoge-
nen Volks-, Gebäude- und Wohnungszählung (Destatis, 2024) und stehen, wie auch Be-
schäftigte auf Hausblockebene, aggregiert zur Verfügung.



## DOKUMENTENVERSION 1.0.2






## 12



## 3 Module
Die Kapitel sind nach den einzelnen Modulen gegliedert. Die Reihenfolge entspricht grob
der tatsächlichen Prozessierung, kann aber aufgrund zyklischer Abhängigkeiten und Ite-
rationen nicht immer vollständig abgebildet werden.
Kapitel 3.1 beschreibt die Markthochlaufprognose, die sowohl für das Fernverkehrsmodul
(Kapitel 3.2.1) als auch für das Nahverkehrsmodul (Kapitel 3.2.2) die Prognosegrundlage
bildet. Anschließend wird in Kapitel 3.3 noch die Berücksichtigung der Bestandsladeinf-
rastruktur erläutert.
## 3.1 Markthochlaufprognose
Die Prognose des Markthochlaufs elektrifizierter Pkw bildet eine zentrale Eingangsgröße
für die Modellierung zukünftiger Ladeinfrastrukturbedarfe. Hierzu wird ein Szenario für die
Entwicklung der Fahrzeugbestände und Neuzulassungen batterieelektrischer Fahrzeuge
(BEV) und Plug-in-Hybridfahrzeuge (PHEV) abgeleitet. Dieses dient als Grundlage für die
Ableitung  zukünftiger  Ladebedarfe  sowie  für  darauf  aufbauende  Anwendungen,  bei-
spielsweise im StandortTOOL oder für langfristige Netzplanungsprozesse.
Die methodische Grundlage der Markthochlaufprognose orientiert sich an einer veröf-
fentlichten Publikation zu Herstellerbefragungen und Markthochlaufannahmen elektrifi-
zierter Pkw (NOW GmbH, 2026). Die dort beschriebenen Datengrundlagen, Annahmen
und Absatzprognosen werden für die Projektion der zukünftigen Fahrzeugbestände von
BEV und PHEV herangezogen.
Für die vorliegende Bedarfsmodellierung wird diese Methodik übernommen. Die Model-
lierung umfasst insbesondere:
- die Entwicklung der jährlichen Neuzulassungen von BEV und PHEV,
- die Fortschreibung der Fahrzeugbestände über den Betrachtungszeitraum,
- die Berücksichtigung der Ausflottung auf Basis einer fahrzeugaltersabhängigen
Überlebensfunktion sowie
- die regionale Differenzierung der Fahrzeugbestände.
Die im Rahmen der Herstellerbefragung erhobenen Prognosen werden auf den Gesamt-
markt hochgerechnet und bilden die Grundlage für die technologiespezifische Entwick-
lung der Neuzulassungen. Für die Fortschreibung der Anteile der jeweiligen Antriebsarten
wird ein Ansatz zur Beschreibung der Marktdurchdringung und technologischen Substi-
tution verwendet, wie er beispielsweise von Fisher und Pry (1971) beschrieben wird. Kon-
kret wird hierfür eine Gompertz-Funktion an die aus der Herstellerbefragung abgeleiteten

## DOKUMENTENVERSION 1.0.2






## 13



Marktanteile angepasst. Die daraus resultierenden Funktionen werden für die Jahre ver-
wendet, für die keine entsprechenden Angaben aus der Herstellerbefragung vorliegen.
Die Antriebsanteile werden anschließend mit der angenommenen Gesamtentwicklung
der Pkw-Neuzulassungen verknüpft. Die zeitliche Veränderung des gesamten Pkw-Fahr-
zeugbestands orientiert sich an den Annahmen der Verkehrsprognose 2040 (Intraplan,
TTS Trimode, ETR, MWP, 2024). Die Fortschreibung der Fahrzeugbestände nach Antriebs-
art erfolgt unter Berücksichtigung der jeweiligen Neuzulassungen und der mittels der
fahrzeugaltersabhängigen Überlebensfunktion abgebildeten Ausflottung. Hierdurch kann
die Entwicklung des elektrifizierten Fahrzeugbestands konsistent über den gesamten Be-
trachtungszeitraum abgebildet werden.
Im Anschluss an die deutschlandweite Modellierung erfolgt eine regionale Differenzie-
rung der Fahrzeugdurchdringung bis auf Ebene der Landkreise. Hierfür werden die aktu-
ellen Bestandsanteile von BEV und PHEV je Landkreis (KBA, 2026) ausgewertet und die
Abweichung vom bundesweiten Durchschnitt bestimmt. Für die Fortschreibung wird an-
genommen, dass sich die regionalen Bestandsanteile langfristig an die deutschlandweite
Entwicklung annähern.
Im Ergebnis liegt das deutschlandweite Markthochlaufszenario für BEV und PHEV diffe-
renziert nach Landkreisen vor. Dadurch wird die mögliche zukünftige Verteilung elektrifi-
zierter Pkw abgebildet.
## 3.2 Verkehrsmodule
Die deutschlandweiten Ladebedarfe aus (NOW GmbH, 2024) werden durch Verkehrsmo-
dule räumlich auf kleinere Bereiche heruntergebrochen.
Es wird zwischen folgenden Ladeverhaltensmustern unterschieden:
- Unterwegsladen findet oftmals während einer Fahrtunterbrechung auf dem Weg
zum Ziel statt und wird mithilfe von Verkehrsmengen aus der Verkehrsumlegung
(siehe 3.2.1), auf Streckenabschnitte verteilt.
- Beim opportunity charging werden Ladevorgänge am Zielort einer Fahrt während
eines Parkvorgangs getätigt. Die Ladebedarfe werden daher auf Basis angezogener
bzw.  erzeugter  Verkehrsmengen  aus  dem  Verkehrserzeugungsmodell  (siehe
3.2.2.1) in der Fläche verteilt.
Kapitel 3.2.1 beschreibt zunächst den Fernverkehr, in dem ausschließlich Unterwegsla-
den stattfindet (siehe 3.2.1.1). Kapitel 3.2.2 behandelt anschließend den Nahverkehr, in
dem sowohl opportunity charging (siehe 3.2.2.1) als auch Unterwegsladen (siehe 3.2.2.2)
berücksichtigt werden.

## DOKUMENTENVERSION 1.0.2






## 14



## 3.2.1 Fernverkehr
Der Fernverkehr umfasst alle Fahrten mit einer Länge von über 100 Kilometern. Bei der
Bedarfsberechnung wird von einem Ladeverhalten im Rahmen einer Fahrtunterbrechung
(Unterwegsladen) ausgegangen.
Um den Ladebedarf in Deutschland möglichst vollständig abzuschätzen, berücksichtigt
das Fernverkehrsmodul auch Fahrten aus dem europäischen Ausland, die entweder eine
Quelle oder ein Ziel in Deutschland haben (Intraplan, TTS Trimode, ETR, MWP, 2024).
Ausgehend von der Anzahl von Fahrten pro Region wird in Kapitel 3.2.1.1 die Verkehrsum-
legung der individuellen Fahrten auf Routen einer Quelle-Ziel-Matrix beschrieben. In
3.2.1.2 wird die  Verkehrsbelastung  mithilfe  tatsächlich  gemessener  punktueller  Ver-
kehrsmengen kalibriert. In 3.2.1.3 wird das Verkehrsaufkommen elektrifiziert und die La-
devorgänge werden simuliert. Danach werden die Energiebedarfe konkreten Anschluss-
stellen und Rastanlagen zugewiesen (siehe 3.2.1.4) und anschließend der repräsentative
Spitzentag berechnet (siehe 3.2.1.5).
## 3.2.1.1 Verkehrsumlegung
Eine Verkehrsumlegung bezeichnet in diesem Fall die Verteilung prognostizierter Ver-
kehrsmengen aus der Quelle-Ziel-Matrix (Intraplan, TTS Trimode, ETR, MWP, 2024) auf die
Straßeninfrastruktur (Anzahl Fahrzeuge/Tag). Die Routen zwischen allen Verkehrszellen
(siehe 2.5) wurden mithilfe von PTV Visum (PTV Planung Transport Verkehr GmbH) berech-
net. Eine „Route“ ist definiert als eine gewählte Verbindung zwischen einem Start- und
Zielpunkt der Quelle-Ziel-Matrix, die aus mehreren Straßensegmenten bestehen kann.
Zur Routenberechnung wird ein Straßennetz der Autobahnen und Bundesstraßen (BKG,
kein Datum) verwendet. In PTV Visum werden die Linien-Features als bidirektionales Stra-
ßennetz importiert und dazu eine zusätzliche Linie für jedes Straßensegment in die Ge-
genrichtung.
Da die modellierten Fahrten innerhalb einer Verkehrszelle beginnen oder enden können,
werden die Verkehrszellen über definierte Anbindungspunkte an das Straßennetz ange-
bunden. Dabei wird die Reisezeit zwischen dem angenommenen Start- bzw. Zielpunkt in-
nerhalb der Verkehrszelle und dem Straßennetz berücksichtigt. Der Verkehr einer Ver-
kehrszelle wird anteilig auf die Anbindungspunkte verteilt.
Würden alle Fahrten aus der Verkehrsmatrix nun direkt auf Straßen umgelegt werden,
würden mehr Fahrzeuge die gleichen Streckenabschnitte fahren und deren Kapazität
übersteigen. In der Realität wird davon ausgegangen, dass alle Fahrenden eigennützig
handeln, um die Reisedauer minimal zu halten (das sog. selfish user equilibrium problem)
und ggf. von der direkten Route abweichen, um Stau zu vermeiden. Diese Abweichung von

## DOKUMENTENVERSION 1.0.2






## 15



direkter zu schnellster Route beschreibt ein Optimierungsproblem, welches durch den
Frank-Wolfe-Algorithmus gelöst werden kann (Ortúzar, 2011).
Die verlängerte Reisezeit aufgrund eines steigenden Verkehrsaufkommens wird durch
CR-Funktionen (capacity restraint functions bzw. Kapazitätsbeschränkungsfunktionen) in
einem Streckenabschnitt simuliert. Für das Straßennetz werden die Kapazität (maximale
Menge an Kraftfahrzeugen pro Stunde) je Streckenabschnitt aus der Straßenart (z. B. Au-
tobahn) und Anzahl Spuren sowie die mittleren Geschwindigkeiten bei ungehindertem
## Verkehrsfluss 푣
## 0
berechnet. Da bei höherer Auslastung des Straßenabschnitts die gefah-
rene Geschwindigkeit je Streckenabschnitt sinkt, verteilen sich alle Fahrzeuge auf ihre
bestmöglichen Routen. Die Parameter (α und β) für die CR-Funktion stammen aus Neu-
hold & Fellendorf (2018).
Das Ergebnis ist der durchschnittliche tägliche Verkehr (DTV) je Route im Straßennetz für
MIV-Fahrten.
3.2.1.2 Kalibrierung durch Dauerzählstellen
Die Kalibrierung der Verkehrsumlegungsergebnisse bezeichnet den Prozess, bei dem die
Nachfragematrix so lange aktualisiert wird, bis die Verkehrsmengen auf den Routen so
nah wie möglich an den tatsächlichen Werten der Dauerzählstellen (BASt) liegen. Dieses
Optimierungsproblem wird durch die Least-Squares-Methode angenähert. Zur Kalibrie-
rung werden die Beobachtungswerte der Dauerzählstellen an das verwendete Straßen-
netz (Zweirichtungsnetz) eingefügt und später wieder übertragen. Als Beobachtungswert
dient der DTV-Pkw (alle Tage Mo bis So), also die durchschnittliche tägliche Verkehrs-
stärke aller Pkws. Die umgelegte Verkehrsstärke wird damit auf das Niveau des gesamten
Pkw-Verkehrs abgeglichen. Die Auswertung erfolgt richtungsfein, die Stichprobe umfasst
1.734 Richtwerte an 867 Autobahnquerschnitten. Es handelt sich durchweg um Auto-
bahnquerschnitte mit hoher Verkehrsbelastung: 99 % der Zählwerte liegen über 5.000
Kfz/24 h, 79 % über 15.000 Kfz/24 h.
Zur Bewertung der Übereinstimmung von modellierten und gemessenen Verkehrsstärken
wird in der Praxis häufig die GEH-Statistik (Feldman, 2012) herangezogen. Der verbreitete
Sollwert GEH < 5 stammt aus den englischen Richtlinien (Department for Transport, 2026)
und ist dort ausdrücklich für Stundenwerte definiert: In die Formel fließen die modellierte
und die gezählte Verkehrsstärke jeweils als hourly flow ein. Die GEH-Statistik ist zudem
nicht selbstskalierend - ihr Wert wächst bei gleicher relativer Abweichung näherungs-
weise mit der Wurzel der Verkehrsstärke, sodass der Sollwert bei einer Tageszählung an-
gehoben werden müsste (Pestel, et al., 2016). Da die hier durchgeführte Umlegung eine
Tagesumlegung ist und als Ergebnis den DTV liefert, ist die unmittelbare Anwendung des
Schwellenwerts 5 auf 24-Stunden-Werte nicht sachgerecht.

## DOKUMENTENVERSION 1.0.2






## 16



Als Einzelwertkriterium wird stattdessen die relative Abweichung zwischen Modell- und
Zählwert verwendet, wobei die zulässige Abweichung mit steigender Verkehrsstärke en-
ger gefasst wird. Bei hohen Verkehrsstärken sind höhere Anforderungen an die relative
Abweichung zu stellen als bei geringen (Pestel, et al., 2016). Verwendet wird die in Tabelle
2 dargestellte Staffelung in vier Verkehrsstärkeklassen. Als Zielgröße gilt in Anlehnung an
WebTAG (Department for Transport, 2026), dass mindestens 85 % aller Zählwerte das To-
leranzband ihrer Klasse einhalten. Aufgrund der Zusammensetzung der Stichprobe ent-
fallen  79 %  der  Werte  auf  die  beiden  oberen  Klassen  (>  50.000  und  15.000–50.000
Kfz/24 h) mit den engsten Toleranzbändern von ± 10 % bzw. ± 15 %, während die unterste
Klasse (< 5.000 Kfz/24 h) mit 16 Werten (aus insgesamt 1.734) praktisch unbesetzt ist. Die
Gesamtbewertung wird damit von den oberen Klassen bestimmt. Ergänzend werden für
die Gesamtstichprobe das Bestimmtheitsmaß R², die Steigung der Regressionsgeraden
durch  den  Ursprung,  die  prozentuale  Wurzel  des  mittleren  quadratischen  Fehlers
(%RMSE) sowie die systematische Abweichung (Bias) ausgewiesen.

Weicht das Umlegungsergebnis zu stark von den Zählwerten ab, können folgende Ände-
rungen durchgeführt werden:
- Änderung von 푣
## 0
bestimmter Routentypen (Autobahnen, Bundesstraßen, etc.)
- Änderung der Parameter der CR-Funktionen
- Änderung der Anteilsverteilung der Anbindungen
- Erhöhung oder Verringerung der Anzahl der Anbindungen in bestimmten Verkehrs-
zellen
Dieser Prozess wird iterativ wiederholt. Nach mehreren Anpassungsschritten ergibt sich
die in Tabelle 2 ausgewiesene Kalibrierungsgüte.

## TABELLE 2: KALIBRIERUNGSGÜTE JE VERKEHRSSTÄRKENKLASSE
## Verkehrsstärkeklasse
(DTV-Kfz)
## Toleranz-
band
## Anzahl
## Werte
Anteil im
## Band
Mittlere absolute Ab-
weichung
## %RMSE
## > 50.000 ± 10 % 104 64 % 8,7 % 11 %
## 15.000 – 50.000 ± 15 % 1.260 75 % 10,2 % 13 %
## 5.000 – 15.000 ± 20 % 354 69 % 15,5 % 19 %
## < 5.000 ± 30 % * 16 69 % 31,4 % 39 %
## Gesamt — 1.734 73 % 11,4 % 13 %
- bzw. absolute Abweichung < 1.500 Kfz/24 h

## DOKUMENTENVERSION 1.0.2






## 17




Über alle 1.734 Richtungswerte beträgt das Bestimmtheitsmaß R² = 0,94. Die Steigung
der Regressionsgeraden durch den Ursprung liegt bei 0,95, der %RMSE bei 13 %. Die mitt-
lere absolute Abweichung beträgt 11,4 %, der Median 9,3 %. Die Summe aller modellier-
ten Verkehrsstärken erreicht 94,7 % der Summe aller Zählwerte; das Modell unterschätzt
die gemessenen Verkehrsstärken damit systematisch um rund 5 %. In der Verteilung der
Einzelabweichungen liegen 53 % der Werte innerhalb von ± 10 %, 84 % innerhalb von
± 20 % und 97 % innerhalb von ± 30 %.
Die Umlegung bildet das Verkehrsstärkeniveau des Autobahnnetzes insgesamt gut ab.
Der lineare Zusammenhang zwischen Modell- und Zählwerten ist mit R² = 0,94 hoch; er
übertrifft den in (Pestel, et al., 2016) genannten unteren Richtwert von 0,88, bleibt jedoch
unter dem strengeren Wert von 0,95. Mit einer Regressionssteigung von 0,95 verbleibt ein
systematischer Maßstabsfehler von rund ~ 5 %. Das strenge Einzelwertkriterium (mindes-
tens 85 % der Werte innerhalb des klassenabhängigen Toleranzbands) wird mit 73 % nicht
erreicht (auf Querschnittsebene, d. h. nach Summierung beider Fahrtrichtungen, 64 %).
Für den Verwendungszweck des Modells ist die erreichte Güte vertretbar, da die Umle-
gungsergebnisse im weiteren Verlauf nicht streckenscharf, sondern aggregiert auf Rast-
anlagen und Anschlussstellen (Kapitel 3.2.1.4) sowie auf den repräsentativen Spitzentag
(Kapitel 3.2.1.5) ausgewertet werden. Da die Abweichungen weder auf einzelne Korridore
konzentriert noch entlang eines Streckenzuges stark korreliert sind, mitteln sie sich auf
dieser Aggregationsebene zu einem Teil heraus.
3.2.1.3 Erstellung von Ladevorgängen
Das Verkehrsaufkommen eines jeden Quelle-Ziel-Paares muss anhand der Markthoch-
laufprognose aus Kapitel 3.1 elektrifiziert werden, d. h. der Anteil elektrischer Fahrzeuge
und deren Ladezustand ist zu ermitteln.
Es wird angenommen, dass die Fahrzeuge ihre Fahrten mit einem vorgegebenen, anfäng-
lichen SOC beginnen. Dieser kann aus der Simulation (NOW GmbH, 2024) hergeleitet
werden und ist in jeder Verkehrszelle wie folgt verteilt:
- 70 % der Fahrzeuge starten mit 90 % SOC.
- 20 % der Fahrzeuge starten mit 70 % SOC.
- 10 % der Fahrzeuge starten mit 50 % SOC.
Je Fahrzeuggröße liegen uns verschiedene Parameter vor, z. B. Batteriekapazität und Ver-
brauch (NOW GmbH, 2026). Daher werden die Fahrzeugsegmente des KBA(KBA, 2025)
gruppiert (Tabelle 3). Für die Modellierung werden die KBA-Fahrzeugsegmente zu vier Mo-
dellsegmenten zusammengefasst: mini, medium, upper und luxury.


## DOKUMENTENVERSION 1.0.2






## 18



Bei den KBA-Segmenten SUV, Mini-Van und Großraum-Van wird die Aufteilung anhand von
ADAC- und weiteren Fahrzeugparametern (wie z. B. Motorgröße) gemacht (ADAC). An-
schließend können über die Aggregation der KBA-Fahrzeugzulassungen (KBA, 2026) nach
Verkehrszellen die Fahrzeuganteile der jeweiligen Segmentgruppen berechnet werden.
Anhand der Markthochlaufprognose aus Kapitel 3.1 kann die Anzahl der Elektrofahrzeuge
je Verkehrszelle und Modellsegment für mehrere Jahre bestimmt werden. Auf Basis der
bereitgestellten technischen Parameter (NOW GmbH, 2026) können je Segmentgruppe
die Batteriekapazität 푐푎푝
## 푠푒푔
und Energieverbrauch 푒
## 푠푒푔
zugewiesen werden. Mithilfe ei-
nes Langstreckenfaktors 푓 und des initialen SOC 푠표푐
## 푖
kann die tatsächliche Reichweite je
## Segment 푟
## 푠푒푔
(in km) nach einem Ladevorgang geschätzt werden:
## 푟
## 푠푒푔
## =푐푎푝
## 푠푒푔
## ∗
## (
## 100
## 푒
## 푠푒푔
## )
## ∗푓∗푠표푐
## 푖

Daraus ergibt sich dann die zu verladene Energiemenge für jedes Fahrzeugsegment 푝
## 푠푒푔

(in kWh):
## 푝
## 푠푒푔
## =푟
## 푠푒푔
## ∗푒
## 푠푒푔
## ∗푓/100


## TABELLE 3: ZUORDNUNG DER FAHRZEUGSEGMENTE AUS DER KBA
KBA Gruppierung Modell
## Mini
## Kleinwagen
mini
## Kompaktklasse
## Sonstige
## Unbekannte Klasse
medium
Mittelklasse upper
## Obere Mittelklasse
## Oberklasse
## Geländewagen
## Sportwagen
## Utilities
## Wohnmobile
luxury
## SUV
Mini-Van
Großraum-Van
Zuordnung anhand zusätzlicher Fahrzeugparameter


## DOKUMENTENVERSION 1.0.2






## 19



3.2.1.4 Zuweisung des Ladevorgänge zu Anschlussstellen und Rastanlagen
Im vorherigen Schritt wurde das elektrische Verkehrsaufkommen jeder Quelle auf ihre
Fahrzeuggruppen verteilt. Für eine Quelle-Ziel-Relation wird die Menge an Elektrofahrzeu-
gen jeder Fahrzeuggruppe
## 2
durch den Durchschnitt ihres jeweiligen Quelle- und Zielver-
kehrsaufkommens bestimmt. Für jede Fahrzeuggruppe werden zwei Ladevorgänge ent-
lang der Route berechnet: der erste bei einem SOC von 15 % und ein weiterer bei einem
SOC von 5 % (siehe Abbildung 2). Diesem „Ladefenster“ werden die Ladevorgänge der
jeweiligen Fahrzeuggruppe zugewiesen. Bei Fahrten, die mehr als einen Ladevorgang be-
nötigen, wird angenommen, dass die Fahrzeugbatterie bis zu 80 % SOC (ACDI, kein
Datum) aufgeladen wird und der nächste Ladevorgang entlang der Route wieder für beide
Fälle berechnet: 15 % und 5 % SOC.



## ABBILDUNG 2: BEISPIEL DES LADEFENSTERS
INNERHALB DER FAHRTSTRECKE EINES E-PKW WIRD ZWISCHEN EINEM SOC VON 5 % UND 15 % EIN
FENSTER MIT MÖGLICHEN LADEORTEN ERSTELLT UND ANSCHLIEßEND MIT DEREN WAHRSCHEINLICH-
KEIT  (BEEINFLUSST  DURCH  Z.  B.  GASTRONOMISCHE  ANGEBOTE)  AUF  DIE  RASTANLAGEN  UND  AN-
## SCHLUSSSTELLEN VERTEILT



## 2
Eine Fahrzeuggruppe ist definiert als eine Kombination aus einem Fahrzeugsegment und einer Anfangs-
SOC. Es gibt insgesamt 12 mögliche Kombinationen (3 SOC-Gruppen und 4 Fahrzeugsegmente).

## DOKUMENTENVERSION 1.0.2






## 20



Die Ladevorgänge und zugehörige verladene Energiemenge zu den Anschlussstellen und
Rastanlagen werden für jede Fahrzeuggruppe innerhalb des Ladefensters auf Basis ihrer
jeweiligen Gewichtung (Tabelle 4) verteilt.


## TABELLE 4: GEWICHTE FÜR DIE ZUWEISUNG ZU ANSCHLUSSSTELLEN UND RASTANLAGEN
## Typ Faktor
Rastanlage ohne Bewirtung 0
Rastanlage mit Bewirtung 6
Anschlussstelle ohne Autohof
## 3
## 1
Anschlussstelle mit Autohof 3

Die Anzahl Ladevorgänge und die benötigte Energiemenge wird für jede Anschlussstelle
und Rastanlage zusammengefasst.
3.2.1.5 Berechnung eines repräsentativen Spitzentages
Bislang spiegeln die den Anschlussstellen und Rastanlagen zugeordneten Tagesstärken
einen durchschnittlichen Tag wider, der sich durch den Jahresbedarf geteilt durch 365
Tage berechnet. Um den Ladebedarf an Spitzentagen zu berücksichtigen, wird die Spit-
zennachfrage der Jahreszählerdaten (Zeitreihen) des letzten verfügbaren Jahres (BASt) er-
mittelt.
Um den Ladebedarf auf die maximal notwendige Leistung auszulegen, wird je Strecken-
abschnitt ein Spitzenfaktor als Verhältnis des maximalen zum durchschnittlichen Ver-
kehrsaufkommen berechnet. Hierfür wird das höchste Verkehrsaufkommen der betrach-
teten Sonn- und Feiertage, Urlaubs- und Werktage verwendet. Die Verkehrsnachfrage und
der Energiebedarf der Anschlussstellen und Rastanlagen entlang des Streckenabschnitts
werden mit diesem Spitzenfaktor multipliziert, um den Ladebedarf an Spitzentagen zu er-
halten.
3.2.1.6 Ergebnisse und Hinweise zur Interpretation
Das Ergebnis des Fernverkehrsmoduls ist die prognostizierte Ladeleistung (in kW) sowie
die verladene Energiemenge (in kWh) je Rastanlage bzw. Anschlussstelle entlang der Au-
tobahn, Jahr und Szenario für Fahrten mit mehr als 100 km. Die Bedarfe werden aus den

## 3
Bei Autobahnabfahrten ohne Autohof besteht die Möglichkeit, dass z. B. nahe gelegene Gewerbegebiete
einen Teil des Ladebedarfs erhalten können.

## DOKUMENTENVERSION 1.0.2






## 21



modellierten Fernverkehrsrouten, dem elektrifizierten Verkehrsaufkommen und der Zu-
weisung zu geeigneten Ladeorten innerhalb der Ladefenster abgeleitet.
Die Ergebnisse zeigen, in welchen Bereichen des Autobahnnetzes zukünftig ein erhöhter
Ladebedarf im Fernverkehr zu erwarten ist. Sie dienen der strategischen Planung des La-
deinfrastrukturausbaus entlang von Fernverkehrsachsen.
Da die Ladeinfrastruktur auch an Tagen mit hohem Verkehrsaufkommen ausreichen soll,
werden die durchschnittlichen Tageswerte mithilfe eines Spitzenfaktors auf einen reprä-
sentativen Spitzentag skaliert.
Die Berücksichtigung bestehender öffentlich zugänglicher Ladeinfrastruktur erfolgt in Ka-
pitel 3.3. Die im Fernverkehrsmodul erzeugten Routen außerhalb der Autobahn werden
außerdem im Nahverkehrsmodul für die Verteilung der Bedarfe des Unterwegsladens
(siehe 3.2.2.2) weiterverwendet.
## 3.2.2 Nahverkehr
Dem Nahverkehr werden alle Fahrten unter 100 Kilometer zugerechnet. Bei diesen wird
davon ausgegangen, dass Ladevorgänge nicht auf der Autobahn stattfinden, sondern
während eines Parkvorgangs (opportunity charging) oder an innerörtlichen Lade-Hubs
(Unterwegsladen) erfolgen (siehe Abbildung 3).
Die deutschlandweiten Ladebedarfe je Lade-Use-Case aus (NOW GmbH, 2024) beziehen
sich auf ein Spitzen-10-Minuten-Zeitfenster. Als Spitzenwert wird das 99. Perzentil der si-
mulierten Ladebedarfe verwendet, um den Einfluss einzelner Ausreißer zu begrenzen. Um
lokale Ladebedarfe zu ermitteln, werden die deutschlandweiten Ladebedarfe räumlich
heruntergebrochen. Dies erfolgt für opportunity charging über ein Verkehrserzeugungs-
modell  und  für  Unterwegsladen  über  eine  Verteilung  entlang  relevanter  Straßenab-
schnitte (Abbildung 3).
In Kapitel 3.2.2.3 wird der Ladebedarf nicht erreichbarer Gebiete auf naheliegende Stra-
ßen verteilt und in Kapitel 3.2.2.4 werden die Ergebnisse und Interpretationshinweise die-
ser Methodik diskutiert.

## DOKUMENTENVERSION 1.0.2






## 22




## ABBILDUNG 3: SCHEMA METHODIK NAHVERKEHR
DIE  DEUTSCHLANDWEIT  BERECHNETEN  LADEBEDARFE  IM  NAHVERKEHR  WERDEN  ÜBER  DAS  VER-
KEHRSERZEUGUNGSMODELL  (OPPORTUNITY CHARGING)  UND KREISSTRAßEN (UNTERWEGSLADEN)
## RÄUMLICH VERTEILT.

Der Ladebedarf im Nahverkehr wird auf einem Gitter mit einer Kantenlänge von 500 Me-
tern ausgegeben. Aufgrund der Vielzahl und Heterogenität von Straßen im Nahverkehrs-
netz erfolgt keine streckenabschnittsgenaue Verortung des Ladebedarfs.
Am Ende dieses Kapitels sollen die verladene Energiemenge und die benötigte Ladeleis-
tung je Gitterzelle, Jahr und Szenario vorliegen.
3.2.2.1 Verkehrserzeugung (opportunity charging)
Ein Verkehrserzeugungsmodell berechnet die Gesamtzahl an angezogenen und erzeug-
ten Wegen je Hausblockzelle und Zeiteinheit im Studiengebiet (Abbildung 4). Die eigent-
lichen Routen, also die gewählten Verbindungen der Ortsveränderung, sind in der Ver-
kehrserzeugung nicht relevant. Jede Fahrt taucht im Ergebnis daher zweimal auf: an ihrem
Start- und ihrem Zielpunkt.

## DOKUMENTENVERSION 1.0.2






## 23




## ABBILDUNG 4: SCHEMA HAUSBLOCKZELLE IM VERKEHRSERZEUGUNGSMODUL

Zuerst wird die Anzahl der erzeugten und angezogenen Personenwege je Hausblockzelle
und Zeiteinheit aus einer Anzahl Personen (Einwohner oder Beschäftigte) zusammen mit
den verschiedenen Verkehrs- und Wegeparametern je Hausblockzelle berechnet. Um
beispielsweise den Kundenverkehr zu berechnen, werden Kundenwege je beschäftigter
Person differenziert nach Branche ermittelt, da zum Beispiel eine ärztliche Praxis mehr
Kundschaft je beschäftigter Person erzeugt als ein Versicherungsbüro.
Wege- und Verkehrsparameter
Der MIV-Anteil der Wege liegt je Raumtyp und Wegezweck vor und wird mithilfe von MiD
(BMDV, 2024) auf Basis von (Bosserhoff, 2006) ermittelt. In Metropolregionen (RegioStaR
71) fahren beispielsweise nur etwa 30 % mit dem Auto zum Einkaufen, während in sehr
ländlichen Regionen (RegioStaR 77) etwa 72 % das Auto nutzen. Die Wahrscheinlichkeit
zur Nutzung des MIV ist nicht elastisch, d. h. hauptsächlich abhängig von Verkehrszweck
und Raum- bzw. Quartierstyp, und ein lokal unterschiedliches ÖPNV-Angebot wird nicht
beachtet. Auch unterschiedliche räumliche Zusammensetzungen von Sozialstrukturen

## DOKUMENTENVERSION 1.0.2






## 24



innerhalb des Raumtyps, wie z. B. Alter, Geschlecht oder Erwerbsstatus, werden nicht bei
der Ermittlung der Anzahl der Fahrten betrachtet4.
Über den Besetzungsgrad, der die Anzahl der Personen je Kfz und Wegezweck enthält,
werden MIV-Wege in MIV-Fahrten umgerechnet. So ist beispielsweise der Besetzungsgrad
im Berufsverkehr mit 1,1 niedrig, wodurch die Anzahl der Fahrten der Anzahl der Wege
relativ gleich ist. Der mittlere Besetzungsgrad über alle Wegezwecke ist dagegen 1,5, wo-
mit durchschnittlich aus z. B. 75 Wegen etwa 50 Fahrten werden. Für große Hausblock-
zellen mit potenziell hohem Binnenverkehr werden Zu- und Abschläge benutzt.
Die modellierten MIV-Fahrten werden anhand der tatsächlichen deutschlandweiten MIV-
Fahrten je Wegezweck und Raumtyp (BMVI, 2018) aus der MiD (BMDV, 2024) kalibriert.
Die Prognose der Anzahl der E-Pkw-Fahrten wird mithilfe des Markthochlaufs (Kapitel 3.1)
auf die Planungsjahre hochgerechnet. Die Verkehrserzeugung wird für ein Ausgangsjahr
erstellt  und  anschließend  mithilfe  des  Markthochlaufs  auf  die  Planungsjahre  fortge-
schrieben. Dadurch kann die bundesweite Vergleichbarkeit der Ergebnisse sichergestellt
werden.
Das Ergebnis sind erzeugte Fahrten von E-Pkw je Hausblockzelle, Jahr und Wegezweck.
## Stellplatzfaktor
Die Verfügbarkeit privater Pkw-Stellplätze beeinflusst die Verfügbarkeit privater und damit
die Notwendigkeit öffentlich zugänglicher Ladeinfrastruktur erheblich. Deshalb werden
die privaten Stellplätze mithilfe der MiD (BMDV, 2024) und RegioStaR 7(BMVI, 2018) ge-
schätzt.
Für jeden Raumtyp kann der Anteil an verfügbaren Pkw-Stellplätzen geschätzt werden.
Nach eigenen Berechnungen auf Basis von (BMDV, 2024) steht beispielsweise 40 % der
Pkw-Nutzenden im urbanen Raum ein Stellplatz zur Verfügung, während der Anteil im
ländlichen Raum 90 % beträgt.
Relevant für den Einfluss der Stellplätze auf die benötigte öffentlich zugängliche Ladeinf-
rastruktur sind dabei die Wegeziele: Fahren zum Beispiel Menschen aus der Großstadt
ohne eigenen Stellplatz aufs Land, sind sie dort auf öffentlich zugängliche Ladeinfrastruk-
tur angewiesen. Umgekehrt können Pendler aus dem Speckgürtel beispielsweise ohne
öffentlich zugängliche Ladeinfrastruktur auskommen, da sie bereits an der heimischen
Wallbox  laden  konnten. Im  Raumtyp  „Kleinstädtischer  dörflicher  Raum  einer

## 4
Daraus resultiert auch ein abweichender Pkw-Besitz im Modell innerhalb Berlins, der im Modell mangels
deutschlandweit verfügbaren detaillierten Regional-Daten über einen stadtweiten Durchschnitt dargestellt
wird. In der Realität aber hätte Steglitz-Zehlendorf 370 Pkw/100 Einwohner, während Friedrichshain-Kreuz-
berg 174 Pkw/100 Einwohner hat (Amt für Statistik Berlin-Brandenburg (2022)).

## DOKUMENTENVERSION 1.0.2






## 25



Stadtregion“ (RegioStaR 74) gehen 5 % der Fahrten in die Großstadt. 90 % der Fahrten aus
der Großstadt, in der wenig private Lademöglichkeiten zur Verfügung stehen, kommen
aus dem gleichen Raumtyp und sind daher verstärkt auf öffentlich zugängliche Ladeinf-
rastruktur angewiesen.
Um diesen Effekt zu beschreiben, wird ein Stellplatzfaktor pro Raumtyp und Wegeanteil-
Matrix berechnet (siehe Anhang 6.2). Alle Wege je Hausblockzelle werden anschließend
mit diesem Stellplatzfaktor multipliziert.
3.2.2.2 Lade-Use-Case „Lade-Hubs” (Unterwegsladen)
Nach Abzug der Ladevorgänge auf Kundenparkplätzen (Kapitel 2.1) wird bei den restli-
chen 44,4 % aus dem Lade-Use „Lade-Hubs“ Unterwegsladen angenommen, was dem
Tankverhalten von Verbrennerfahrzeugen ähnelt. Dieser Bedarf wird mithilfe des DTV aus
der Fernverkehrsumlegung (siehe Kapitel 3.2.1.1) auf übergeordnete Straßen außerhalb
der Autobahn verortet. In Städten ohne übergeordnete Straßen werden zusätzlich Ge-
meinde- oder Kreisstraßen mit einer konstanten Verkehrsstärke (Statistisches Landesamt
Baden-Württemberg, 2026) gesondert berücksichtigt, da hier das Straßennetz zu feinma-
schig ist, um durch die Verkehrsumlegung benutzt zu werden.
Für jeden Streckenabschnitt wird das Produkt aus der Länge des Streckenabschnitts und
seiner Verkehrsmenge gebildet. Anschließend wird dieser Wert je Gitterzelle summiert.
Der Anteil, den jeder Wert an der Gesamtsumme aller Gitterzellen im gleichen Landkreis
hat, wird als Gewichtungsparameter für die Verteilung der Ladebedarfe verwendet.
Der zu verteilende Bedarf für diesen Use-Case wird zunächst wie in Kapitel 3.2.2.1 verteilt
und je Landkreis summiert, um Ausreißer zu vermeiden. Anschließend wird der Bedarf je
Landkreis mit dem oben berechneten Gewichtungsparameter multipliziert. Zum Schluss
werden die umverteilten Ladeleistungen wieder auf die Gitterzellen anhand der anteiligen
Länge des Straßenabschnitts in dieser Gitterzelle umgelegt, um mit den anderen Lade-
Use-Cases zusammen abgebildet werden zu können. Um keine Ladeinfrastruktur auf
reine Wohngebiete umzulegen, werden lediglich Gitterzellen mit einem Hauptanteil von
Misch- oder Gewerbegebieten berücksichtigt.
Für die räumliche Verteilung wird angenommen, dass Straßenabschnitte mit höherem
Verkehrsaufkommen auch einen höheren Bedarf für Unterwegsladen an Lade-Hubs er-
zeugen. Diese Annahme ermöglicht eine bundesweit konsistente Verteilung des Ladebe-
darfs auf relevante Straßenräume.

3.2.2.3 Gebietsausschluss und Umverteilung nicht erreichbarer Ladebedarfe
Bei der Berechnung des Ladebedarfs im Nahverkehr entstehen auch MIV-Fahrten an Or-
ten,  die Einwohnende  oder  Beschäftigte aufweisen,  aber nicht  an  das  öffentliche

## DOKUMENTENVERSION 1.0.2






## 26



Straßennetz angebunden sind. Das können zum Beispiel Berghütten, Vogelwarten im Na-
turschutzgebiet und autofreie Inseln sein. Dort würde in der Realität grundsätzlich kein
Ladebedarf für öffentlich erreichbare Ladeinfrastruktur entstehen.
Die An- und Abfahrten zu diesen POIs finden dennoch oft statt, enden aber bereits außer-
halb des Gebiets (z. B. Wanderer, die vor dem Hüttenaufstieg im Tal parken). Daher kön-
nen die erzeugten Wege auf das nächstgelegene Straßennetz verteilt werden.
Die öffentlich „erfahrbaren“ Gebiete lassen sich über die flächendeckende Berechnung
von Isochronen ermitteln (siehe Anhang 6.2). Gebiete außerhalb der öffentlichen Erreich-
barkeit, z. B. Forstwege oder Kasernen, werden auf diese Weise automatisch von der La-
debedarfsverteilung ausgeschlossen.
Als Ergebnis kann man, besonders im alpinen Bereich, wo durch Gaststättenpersonal auf
Almen und Berghütten Verkehr erzeugt wird, eine gewünschte Umverteilung in die Täler
beobachten (siehe Abbildung 5). Weiterhin wurden die autofreien Inseln aktiv ausge-
schlossen, z. B. Hiddensee, Mainau oder Wangerooge. Deren Wege werden aktuell auf
den nächsten Punkt umverteilt, der mit dem Pkw erreichbar ist.


## ABBILDUNG 5: UMVERTEILUNG UNERREICHBARER LADEBEDARFE
MIT DEM PKW UNERREICHBARE GEBIETE (Z. B. ALMHÜTTEN) WERDEN AUF ZIELGEBIETE IM TAL VERTEILT.

3.2.2.4 Ergebnisse und Hinweise zur Interpretation
Das Ergebnis des Nahverkehrsmoduls ist die prognostizierte Ladeleistung in kW je Gitter-
zelle, Jahr und Szenario sowie die verladene Energiemenge in kWh je Gitterzelle, Jahr und

## DOKUMENTENVERSION 1.0.2






## 27



Szenario. Dabei werden die Ladebedarfe aus opportunity charging während eines Park-
vorgangs und aus dem Unterwegsladen an (innerörtlichen) Lade-Hubs in eine gemein-
same Gitterzelle zusammengeführt.
Die Ergebnisse zeigen, in welchen räumlichen Bereichen zukünftig ein erhöhter Bedarf an
öffentlich zugänglicher Ladeinfrastruktur im Nahverkehr zu erwarten ist. Sie dienen damit
insbesondere der Identifikation von Bedarfsschwerpunkten und der strategischen Aus-
bauplanung. Eine standortscharfe Festlegung einzelner Ladepunkte ersetzen sie nicht,
da  hierfür  zusätzlich  lokale  Rahmenbedingungen  wie  Flächenverfügbarkeit,  Netzan-
schlussmöglichkeiten und baurechtliche Anforderungen berücksichtigt werden müssen.
Die Modellierung erfolgt bundesweit konsistent und basiert auf einheitlich verfügbaren
Datenquellen und Annahmen. Lokale Besonderheiten, wie größere Neubaugebiete, neue
Gewerbestandorte, touristische Sondersituationen oder kleinräumige Abweichungen im
Mobilitätsverhalten, können daher nicht in jedem Einzelfall vollständig abgebildet wer-
den. Die Ergebnisse sollten deshalb vor Ort mit lokalem Wissen plausibilisiert und für
konkrete Standortentscheidungen weiter geprüft werden.
Bei der Interpretation der Bedarfsergebnisse sind die weiter in der Zukunft liegenden Prog-
nosewerte vorzuziehen, da sich bei diesen die Effekte durch den tatsächlichen (also
nicht-prognostizierten) Markthochlauf von EVs ausgeglichen sind.
Die Ergebnisse des Nahverkehrsmoduls stellen zunächst den modellierten Ladebedarf
dar. Die Berücksichtigung bestehender öffentlich zugänglicher Ladeinfrastruktur erfolgt
anschließend in Kapitel 3.3.
3.3 Berücksichtigung von Bestandsladeinfrastruktur
In den vorherigen Kapiteln wurde Ladebedarf berechnet unter der Annahme, dass bisher
keine Ladeinfrastruktur aufgebaut wurde. Im Folgenden wird dieser Gesamtladebedarf
Brutto-Bedarf genannt. Um dennoch bereits aufgebaute Ladepunkte zu berücksichtigen
und den Akteuren eine realistische Größe des noch aufzubauenden Ladebedarfs zu lie-
fern, wird dieser Brutto-Bedarf mit den gemeldeten öffentlich zugänglichen Ladepunkten
(Bundesnetzagentur, kein Datum) verrechnet. Das Ergebnis ist die Menge an zusätzlich
benötigtem Ladebedarf, im Folgenden auch Netto-Bedarf genannt. Berücksichtigt wer-
den  soll  dabei  besonders  der  „Ausstrahlungseffekt“  von  Ladeinfrastruktur  über  den
räumlich unmittelbaren Bereich hinaus (siehe Kapitel 3.3.1 und 3.3.2). Dies können nach-
folgende Rastanlagen auf der Autobahn im Fernverkehr sein oder Nachbarquartiere im
## Nahverkehr.

## DOKUMENTENVERSION 1.0.2






## 28



Da der Ladebedarf im Fernverkehr pro Streckenabschnitt und im Nahverkehr pro Gitter-
zelle berechnet wird, ist auch die Berechnung der Bestandsladeinfrastruktur in Fern- (Ka-
pitel 3.3.1) und Nahverkehr (Kapitel 3.3.2) unterteilt.
Bestandsladeinfrastruktur nahe der Autobahn wird zu angenommenen 75 % dem Fern-
verkehr und 25 % dem Nahverkehr zugeteilt, um die Wirkung auf beide Verkehrsarten dar-
stellen zu können. Für eine realistischere Aufteilung auf Fern- und Nahverkehr wäre die
Fahrzeugherkunft der Ladevorgänge notwendig, aber diese Daten liegen aktuell nicht vor.
Die Ladeleistungen im Fernverkehr setzen sich also aus 100 % der Ladeleistungen des
Lade-Use-Cases „Auf Rastanlagen“ und anteilig der Ladeleistungen aus „Entlang Fern-
verkehrsachsen“ zusammen. NLP neben der Autobahn werden komplett der Gemeinde
zugesprochen.
## 3.3.1 Fernverkehr
Pro Rastanlage oder Anschlussstelle wird die vorhandene Bestandsladeleistung vom
Brutto-Ladebedarf abgezogen, um den Netto-Ladebedarf zu erhalten. Übersteigt der auf-
gebaute Ladeinfrastrukturbestand auf einer Rastanlage den für ein Jahr und Szenario be-
rechneten Brutto-Bedarf, entsteht ein negativer Netto-Bedarf bzw. ein Überschuss an Be-
standsladeleistung.  Dieser Überschuss wird auf  nachfolgende  Rastanlagen  und  An-
schlussstellen umverteilt (Abbildung 6). Ein Ziel der Umverteilung ist es, Bedarfe zu iden-
tifizieren, die durch nahegelegene Ladeinfrastruktur bereits gedeckt sind.


## ABBILDUNG 6: SCHEMA BESTANDSUMVERTEILUNG IM FERNVERKEHR
AM OBEREN KNOTEN (LINKS) BEFINDEN SICH 100 KW MEHR BESTAND ALS BEDARF ERMITTELT WURDE,
DAHER IST DER NETTO-BEDARF NEGATIV. ÜBER DIE UMVERTEILUNGSFAKTOREN (GRÜN) WERDEN IM
ERSTEN SCHRITT DER ÜBERSCHUSS AUF DIE NÄCHSTEN KNOTEN UMVERTEILT  (MITTE). WEITERHIN

## DOKUMENTENVERSION 1.0.2






## 29



BEFINDET SICH EIN NEGATIVER BEDARF AUF DEM KNOTEN, DAHER WIRD DER RESTLICHE ÜBERSCHUSS
## WIEDER WEITERVERTEILT, BIS DAS NETZ AUSGEGLICHEN IST (RECHTS).

Grundlage für die Identifikation der Rastanlagen und Anschlussstellen, auf die der Über-
schuss umgelegt wird, bilden die gefahrenen Routen des Fernverkehrsmoduls (Kapitel
3.2.1.1). Aus diesen wird ein gerichteter Graph erstellt. Die Knoten bilden die Rastanlagen
und Anschlussstellen. Die Kanten zwischen zwei benachbarten Rastanlagen oder An-
schlussstellen entsprechen der Fahrstrecke, gewichtet mit dem DTV sowie den Kilome-
tern. Auf diesen zwei Parametern aufbauend werden Umverteilungsfaktoren zwischen be-
nachbarten Rastanlagen bzw. Anschlussstellen berechnet, die den überschüssigen Be-
stand umverteilen können. Diese Faktoren müssen je Ausgangsknoten (in Fahrtrichtung)
in Summe 1 ergeben, sodass nicht zu viel oder zu wenig Bestandsladeinfrastruktur um-
verteilt wird.
Bildlich kann man sich die Bestandsumverteilung wie folgt vorstellen: Die Überschüsse
werden in jeder Iteration so lange in Fahrtrichtung verschoben, bis sie einen noch offenen
Bedarf decken können. Deckt nur ein Teil des umverteilten Überschusses den Rest-Be-
darf auf der neuen Rastanlage, wird der Überschuss geteilt und der neue Rest-Über-
schuss in der nächsten Iteration weiter umverteilt. An Gabelungen werden die Über-
schüsse entsprechend den Umverteilungsfaktoren aufgeteilt. Die Weiterleitung der Über-
schüsse ist beendet, wenn ein Schwellenwert an zurückgelegten Kilometern überschrit-
ten wird, der Überschuss nach häufiger Teilung irrelevant klein geworden ist oder in einer
Sackgasse endet. Dann werden die übrigen Überschüsse wieder der ursprünglichen Ras-
tanlage zugeteilt und summiert, von der sie ursprünglich stammen. Dadurch kann es
auch am Ende der Umverteilung an Rastanlagen und Anschlussstellen zu einem negati-
ven Netto-Bedarf kommen.
Das Ergebnis ist der zusätzlich benötigte Ladebedarf im Fernverkehr je Rastanlage und
Anschlussstelle für verschiedene Jahre und Szenarien. Im Ergebnis zeigt sich, dass die
Ungleichheiten des Netto-Bedarfs je Rastanlage und Anschlussstelle durch die Umver-
teilung geglättet wurden, indem Lücken mit ungefülltem Bedarf gedeckt wurden.
## 3.3.2 Nahverkehr
Da der Bestand im Nahverkehr pro Gitterzelle berechnet wird, wird dementsprechend
auch die Ausstrahlung als Rasterebene berechnet. Diese Raster-Ausstrahlungstabelle
definiert, wie sich aufgebaute Ladeinfrastruktur in einer Gitterzelle auf andere Zellen in
der Umgebung auswirkt.

## DOKUMENTENVERSION 1.0.2






## 30



Für jede aufgebaute Bestandsladestation wird von einem Wirkungsraum ausgegangen,
der über den unmittelbaren Bereich der Errichtungszelle hinausgeht. Die Ausstrahlungs-
tabelle enthält dazu für jede Gitterzelle die erreichbaren Gitterzellen sowie einen Umver-
teilungsfaktor, der die Ausstrahlungsstärke der Bestandsladeinfrastruktur nach Ladeleis-
tungskategorie (NLP oder SLP) differenziert beschreibt (Tabelle 5).

## TABELLE 5: BEISPIELHAFTER AUSSCHNITT DER AUSSTRAHLUNGSTABELLE (NAHVERKEHR)
Errichtungszelle Fahrzeit (s) Zielzellen NLP-Faktor SLP-Faktor
## A 60 B 0,26 0,16
## A 60 C 0,26 0,16
## A 60 D 0,26 0,16
## A 120 E 0,11 0,05
## A 120 F 0,11 0,05

Mit wachsendem Abstand zum Errichtungsort nimmt der Einfluss der Bestandsladeinfra-
struktur ab. Ein Schnellladepunkt wirkt räumlich weitreichender als ein Normalladepunkt
(Abbildung 7).


## ABBILDUNG 7: BEISPIEL AUSSTRAHLUNGEN DER BESTANDSLADEINFRASTRUKTUR
## EIN SCHNELLLADEPUNKT STRAHLT WEITER AUS ALS EIN NORMALLADEPUNKT.


## DOKUMENTENVERSION 1.0.2






## 31



Der abzuziehende Betrag entspricht der ausgestrahlten Bestandsladeleistung und gibt
an, um welchen Wert der berechnete Brutto-Ladebedarf in der jeweiligen Zelle reduziert
werden muss. Die summierte Leistung je Start-Zelle und Ladeleistungskategorie wird mit
den Faktoren aus der Ausstrahlungstabelle multipliziert und anschließend je Zielzelle (un-
abhängig von der Ladeleistungskategorie) summiert.

## Beispiel
In Zelle A aus Tabelle 5 besteht Bestandsladeinfrastruktur mit insgesamt 50
kW NLP- und 400 kW SLP-Leistung. Dadurch erhält die Ziel-Zelle B eine Leis-
tung von 0,26 ∗ 50 kW = 13,00 kW für NLP und 0,16 ∗ 400 kW = 64,00 kW für
SLP als abzuziehender Bestand.

Das Ergebnis ist eine Tabelle mit Gitterzellen-ID (getrennt an Hindernissen), Jahr, Szenario
und abzuziehender Bestand in kW. Dieser Bestand wird anschließend vom Brutto-Bedarf
je Gitterzelle, Jahr und Szenario abgezogen.

Die Berechnung des Wirkungsraums einer Ladestation ist eine Annahme. Es wird eher da-
von ausgegangen, dass Umwege beim opportunity charging nicht in Kauf genommen wer-
den. Andere Faktoren, die Umwege für E-Pkw-Fahrende beeinflussen, wie z. B. der Lade-
preis oder die Nähe zu einem Restaurant, wurden nicht direkt auf die Größe und Stärke
des Wirkungsraums einbezogen.
Übersteigt der lokale Bestand den ebenfalls lokal ermittelten Bedarf, z. B. nach dem Auf-
bau eines großen Schnellladeparks, kann an diesem Ort ein negativer Netto-Bedarf ent-
stehen.
Hat eine Gemeinde, in der sich die negativen Gitterzellen befinden, noch Gitterzellen mit
positivem Netto-Bedarf, wird der Überschuss anteilig über einen Faktor von diesen abge-
zogen. Lässt sich dennoch ein negativer Bedarf in der Gemeinde nicht vermeiden (weil z.
B. der Netto-Bedarf der Gemeinde bereits 0 kW betrug), so bleibt der negative Bedarf auf
das unmittelbare Umfeld begrenzt. Eine Weiterverteilung des negativen Bedarfs auf die
nächsthöhere Verwaltungsebene (z. B. den Landkreis) ist nicht vorgesehen.


## DOKUMENTENVERSION 1.0.2






## 32



## 4 Zusammenfassung
Das StandortTOOL liefert eine räumlich und zeitlich hochaufgelöste Prognose des Be-
darfs an öffentlich zugänglicher Ladeinfrastruktur für Elektrofahrzeuge in Deutschland.
Grundlage sind deutschlandweite Ladebedarfe aus (NOW GmbH, 2024) sowie weitere
Datenquellen zur Modellierung von Mobilität und Verkehr. Die räumliche Differenzierung
erfolgt getrennt für Fern- und Nahverkehr, da sich Ladeverhalten und Verortung der Lade-
vorgänge in beiden Bereichen unterscheiden.
Im Fernverkehr (Kapitel 3.2.1) wird der Ladebedarf entlang der Autobahnen modelliert
und Rastanlagen bzw. Anschlussstellen zugewiesen. Die Bedarfe werden aus modellier-
ten Fernverkehrsrouten, dem elektrifizierten Verkehrsaufkommen sowie der Zuweisung
zu geeigneten Ladeorten innerhalb von Ladefenstern abgeleitet. Um die Ladeinfrastruktur
auch für Tage mit hohem Verkehrsaufkommen auszulegen, werden durchschnittliche Ta-
geswerte mithilfe eines Spitzenfaktors auf einen repräsentativen Spitzentag übertragen.
Im Nahverkehr (Kapitel 3.2.2) wird angenommen, dass Ladevorgänge nicht auf der Auto-
bahn stattfinden, sondern als opportunity charging während eines Parkvorgangs sowie als
Unterwegsladen an innerörtlichen Lade-Hubs erfolgen. Die räumliche Ausgabe erfolgt
nicht streckenabschnittsgenau, sondern wird aufgrund der Vielzahl und Heterogenität
der Straßen auf ein einheitliches Geogitter mit Kantenlänge von 500 m aggregiert. Ergeb-
nis sind Ladeleistung (kW) und verladene Energiemenge (kWh) je Gitterzelle, Jahr und Sze-
nario.
Die  in  den  Verkehrsteilen  ermittelten  Ergebnisse  stellen  zunächst  den  modellierten
Brutto-Ladebedarf dar. Um bereits aufgebaute öffentlich zugängliche Ladeinfrastruktur
zu berücksichtigen, wird der Brutto-Bedarf mit gemeldeten Ladepunkten verrechnet (Ka-
pitel 3.3). Daraus wird ein Netto-Ladebedarf als zusätzlich erforderlicher Ausbau abgelei-
tet. Dabei werden Ausstrahlungseffekte berücksichtigt: Im Fernverkehr können benach-
barte Rastanlagen/Anschlussstellen profitieren, im Nahverkehr wirken Ladepunkte auch
in umliegende Gitterzellen.
Die Ergebnisse eignen sich insbesondere zur Identifikation räumlicher Bedarfsschwer-
punkte, zur strategischen Ausbauplanung und zur Vergleichbarkeit zwischen Regionen
und Szenarien. Aufgrund der zusätzlich erforderlichen lokalen Kenntnisse, etwa zu Netz-
anschluss, baurechtlichen Gegebenheiten, bestehenden Verkehrskonzepten und Kon-
zepten zum ruhenden Verkehr, kann das StandortTOOL hingegen keine standortscharfe
Vorgabe oder Prüfung einzelner Standorte vornehmen. Hierzu ist das Wissen vor Ort und
die Zusammenarbeit unterschiedlicher kommunaler und privater Akteure essenziell.


## DOKUMENTENVERSION 1.0.2






## 33



## 5 Literaturverzeichnis
ACDI. (kein Datum). Why 80% is the Sweet Spot for Charging Your EV. Abgerufen am 11.
05  2026  von  https://acd-inc.com/blog/why-80-is-the-sweet-spot-for-charging-
your-ev/
ADAC. (kein Datum). ADAC Autodatenbank.
BASt. (kein Datum). Automatische Dauerzählstellen (Daten/Rohdaten).
BKG. (2026). Datenquellen:
https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_we
b_ors_all.pdf.
BKG.  (kein  Datum). Digitale  Landschaftsmodelle.  Abgerufen  am  15.  April  2026  von
https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/digitale-
landschaftsmodelle.html
BMDV. (2024). Mobilität in Deutschland 2023 (MiD 2023).
BMVI. (2018). Regionalstatistische Raumtypologie (RegioStaR) des BMVI. Abgerufen am
-  05  2026  von  https://www.bmv.de/SharedDocs/DE/Anlage/G/regiostar-
arbeitspapier.pdf?__blob=publicationFile
Bosserhoff,  D.  (2006). Hinweise  zur  Schätzung  des  Verkehrsaufkommens  von
Gebietstypen. Forschungsgesellschaft für Strassen- und Verkehrwesen (FGSV).
Bundesnetzagentur.  (kein  Datum). Ladesäulenkarte.  Abgerufen  am  20.  04  2026  von
https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-
Mobilitaet/Ladesaeulenkarte/start.html
Department  for  Transport.  (2026). TAG  Unit  M3.1 — Highway  Assignment  Modelling.
## Transport Analysis Guidance. Von
https://www.gov.uk/government/publications/webtag-tag-unit-m3-1-highway-
assignment-modelling abgerufen
Destatis.  (2024). Zensus  2022. Wiesbaden:  Statistisches  Bundesamt  (Destatis).  Von
https://ergebnisse.zensus2022.de/datenbank/online/?locale=de abgerufen
## EU. (2023). VERORDNUNG (EU) 2023/1804 DES EUROPÄISCHEN PARLAMENTS UND DES
RATES. Von https://eur-lex.europa.eu/legal-
content/DE/TXT/PDF/?uri=CELEX:32023R1804 abgerufen
Feldman, O. (2012). The GEH measure and quality of the highway assignment models.
London: Association for European Transport and Contributors. Abgerufen am 11.
05    2026    von    https://aetransport.org/public/downloads/V7AGa/5664-
## 5218a2370407f.pdf
Fisher, J. C., & Pry, R. H. (1971). A simple substitution model of technological change.
Technological Forecasting and Social Change, 3, 75–88.
Hendzlik,  M.  e.  (2024). „Bausteine  für  einen  klimagerechten  Verkehr“. Von
https://www.umweltbundesamt.de/sites/default/files/medien/366/dokumente/2

## DOKUMENTENVERSION 1.0.2






## 34



## 024-04_kliv_uebersicht_bausteine_klimavertraeglicher_verkehr_uba.pdf
abgerufen
infas. (2024). Erwerbstätige Personen am Arbeitsort. Bonn.
Intraplan,  TTS  Trimode,  ETR,  MWP.  (2024). Verkehrsprognose  2040;  Band  6.1  E:
Verkehrsentwicklungsprognose   Prognosefall   1   „Basisprognose   2040“
(Ergebnisse). München / Freiburg / Hamburg.
KBA.   (2025). Segmente.   Abgerufen   am   20.   04   2026   von
https://www.kba.de/DE/Statistik/Fahrzeuge/Neuzulassungen/Segmente/n_segm
ente_node.html
KBA.  (2026). Monatliche  Neuzulassungen.  Abgerufen  am  20.  April  2026  von
https://www.kba.de/DE/Statistik/Fahrzeuge/Neuzulassungen/MonatlicheNeuzul
assungen/monatl_neuzulassungen_node.html
Neuhold, R., & Fellendorf, M. (2018). Ermittlung von Kapazitätsbeschränkungsfunktionen
anhand empirischer Verkehrsdaten. Straßenverkehrstechnik(6), 401–413.
NOW GmbH. (2024). Ladeinfrastruktur nach 2025/2030: Szenarien für den Markthochlauf
## - Neuauflage 2024.
NOW  GmbH.  (2026). Klimafreundliche  Pkw  in  Deutschland:  Herstellerbefragung  zu
Absatzprognosen  und  Technologietrends  2025. Von  https://www.now-
gmbh.de/wp-content/uploads/2026/04/NOW_Broschuere_Cleanroom-
Gespraeche-2025.pdf abgerufen
## Ortúzar, J. (2011). Modelling Transport.
Pestel,  E.,  Friedrich,  M.,  Heidl,  U.,  Pillat,  J.,  Schiller,  C.,  &  Schimpf,  M.  (2016).
Qualitätssicherung von Verkehrsnachfragemodellen. Straßenverkehrstechnik.
PTV  Planung  Transport  Verkehr  GmbH.  (kein  Datum). PTV  Visum. Karlsruhe.  Von
https://www.ptvgroup.com/de/produkte/ptv-visum abgerufen
Qian, Z., & Zhang, H. (2012). On centroid connectors in static traffic assignment: Their
effects on flow patterns and  how to optimize their selections. Transportation
## Research    Part    B:    Methodological,    46(10),    1489–1503.
doi:10.1016/j.trb.2012.07.006
Statistisches  Landesamt  Baden-Württemberg.  (2026). Durchschnittliche  tägliche
Verkehrsstärke (DTV) auf den Außerortsstraßen und Ordsdurchfahrtstraßen seit
## 1985.
Umweltbundesamt.  (2024). Verkehr  belastet  Luft  und  Klima - Minderungsziele  der
## Bundesregierung. Von
https://www.umweltbundesamt.de/daten/verkehr/emissionen-des-
verkehrs#verkehr-belastet-luft-und-klima-minderungsziele-der-bundesregierung
abgerufen
Uni Innsbruck. (kein Datum). Databases and Information Systems.



## DOKUMENTENVERSION 1.0.2






## 35



## 6 Anhang
## 6.1 Szenarien
Wie in Kapitel 2.1 beschrieben, verwendet das StandortTOOL fünf Szenarien aus (NOW
GmbH, 2024). Diese Szenarien werden nicht im StandortTOOL neu berechnet, sondern
aus (NOW GmbH, 2024) übernommen und räumlich differenziert. Die Methodik der räum-
lichen Verortung unterscheidet sich zwischen Nah- und Fernverkehr:
Nahverkehr (Lade-Use-Cases 4, 5 und 6)
Für den Nahverkehr werden alle fünf Szenarien eigenständig modelliert:
- Die deutschlandweiten Gesamtbedarfe aus (NOW GmbH, 2024) werden für jedes
Szenario als Eingangswerte verwendet
- Die in Kapitel 3.2.2 beschriebene Methodik wird für jedes Szenario separat durch-
geführt
- Ergebnis: Räumlich differenzierter Ladebedarf pro 500 m-Gitterzelle, Jahr und Sze-
nario
Fernverkehr (Lade-Use-Case 7)
Für den Fernverkehr wird nur das Referenzszenario vollständig modelliert (Kapitel 3.2.1);
die übrigen vier Szenarien werden aus den Ergebnissen des Referenzszenario durch Ska-
lierung abgeleitet. Die fünf Szenarien aus (NOW GmbH, 2024) unterscheiden sich in An-
nahmen, die die deutschlandweite Höhe des Ladebedarfs je Lade-Use-Case verändern -
insbesondere in der Verfügbarkeit nicht öffentlich zugänglicher Ladepunkte und im Anteil
des HPC-Ladens. Die in das Fernverkehrsmodul eingehenden Größen (Verkehrsumle-
gung und Verkehrsbelastung, Fahrzeugsegmente und deren technische Parameter, die
Verteilung der Anfangsladezustände sowie die Zuweisung zu Rastanlagen und Anschluss-
stelle) sind in allen fünf Szenarien identisch.  Die räumliche Verteilung des Ladebedarfs
ist damit unabhängig vom Szenario. Die Skalierung wird wie folgt durchgeführt:
- Berechnung des Skalierungsfaktors aus der deutschlandweiten Gesamtleistung
des betrachteten Szenarios (푀푊
## 푠푐푛푒푠푎푟푖표
) und des Referenzszenarios (푀푊
## 푟푒푓
## ):
## 푠푐푎푙푖푛푔_푓푎푐푡표푟
## 푠푐푒푛푎푟푖표
## =
## 푀푊
## 푠푐푒푛푎푟푖표
## 푀푊
## 푟푒푓

- Anwendung des Skalierungsfaktors auf alle Rastanlagen und Anschlussstellen:
## 푐ℎ푎푟푔푖푛푔_푝표푤푒푟
## 푠푐푒푛푎푟푖표
## =푐ℎ푎푟푔푖푛푔_푝표푤푒푟
## 푟푒푓
## ∗푠푐푎푙푖푛푔_푓푎푐푡표푟
## 푠푐푒푛푎푟푖표


## DOKUMENTENVERSION 1.0.2






## 36



## 6.2 Stellplatzverfügbarkeit
Die Stellplatzverfügbarkeit am Abfahrtsort 푆
## 푧
ergibt sich aus der Stellplatzverfügbarkeit
des Raumtyps 푆
## 푟
(siehe Tabelle 6) und der Wegeanteil-Matrix 푊 (siehe Tabelle 7) durch
die folgende Formel:
## 푆
## 푧
## =푆
## 푟
## ∗푊
Der Stellplatzfaktor berechnet sich anschließend über
## 푆=
## 1
## 푆
## 푧
## 푆_푧
## ̅̅̅̅

mit 푆_푧
## ̅̅̅̅
als Durchschnitt aller Stellplatzfaktoren am Zielort.

## TABELLE 6: STELLPLATZFAKTOR JE RAUMTYP AM ZIELORT
Ziel-RegioStaR der Fahrt Stellplatzfaktor am Zielort 푺
## 풛

## 71 1,78
## 72 1,22
## 73 1,11
## 74 0,68
## 75 0,96
## 76 0,96
## 77 0,83

## 6.3 Isochronen
„Isochrone bezeichnen in der Verkehrsgeographie die Verbindungslinien aller Orte, wel-
che von einem Ausgangspunkt aus in derselben Zeit erreichbar sind“ (Uni Innsbruck). Mit
diesen soll das Wirkungsgebiet von bereits aufgebauter Ladeinfrastruktur bestimmt wer-
den (Kapitel 3.3.2).
Zunächst werden die Gitterzellen des Geo-Gitters an Hindernissen in Form von Gewäs-
sern oder Bahnanlagen aus dem Basis-DLM zerschnitten, mit Ausnahme von Brücken
(Abbildung 8). Dadurch kann sichergestellt werden, dass Bestandsladeinfrastruktur in Ka-
pitel 3.3.2 nur auf der jeweiligen Seite berücksichtigt wird. Ohne diese Zerteilung könnte

## DOKUMENTENVERSION 1.0.2






## 37



aufgebaute  Ladeinfrastruktur  der  gegenüberliegenden  Uferseite  zugeordnet  werden,
wenn eine normale Gitterzelle beide Uferseiten abdeckt.

## TABELLE 7: WEGE-ANTEILE 푊
DIESE BESCHREIBEN, WIE VIEL PROZENT DER FAHRTEN VON EINEM QUELL- IN EINEN ZIEL-RAUMTYP
WECHSELN. ZUM BEISPIEL BLEIBEN 85 % DER FAHRTEN AUS RAUMTYP "71" IM GLEICHEN RAUMTYP.
## 71 72 73 74 75 76 77
## 71 84,8 2,79 8,59 0,85 0,68 0,67 1,09
## 72 3,20 79,24 10,30 3,15 0,72 1,60 1,79
## 73 6,37 6,67 77,50 3,11 1,00 2,91 2,45
## 74 3,38 10,40 15,11 60,04 1,90 4,25 4,91
## 75 1,59 1,61 3,70 1,36 74,25 9,78 7,72
## 76 1,50 1,91 4,93 1,49 4,71 75,32 10,15
## 77 1,75 2,49 5,10 2,21 4,56 12,23 71,65



## ABBILDUNG 8: AUFSPLITTUNG DER GEOGITTER
URSPRÜNGLICH QUADRATISCHE GEOGITTER WERDEN AN HINDERNISSEN WIE WASSERFLÄCHEN (Z. B.
FLÜSSE) ODER BAHNSTRECKEN AUFGETEILT, SODASS LADEINFRASTRUKTUR DER RICHTIGEN SEITE DES
FLUSSES ODER BAHNSTRECKE ZUGETEILT WERDEN UND NUR DORT WIRKUNG DARGESTELLT WERDEN
## KANN (SCHEMA)


## DOKUMENTENVERSION 1.0.2






## 38




Für jede dieser vollständigen oder geschnittenen Gitterzellen werden mithilfe des Rou-
tingPlus-Dienstes (BKG, 2026) Isochronen mit den Reichweiten von 60, 120 und 300 Se-
kunden berechnet. Geringere Einflussbereiche simulieren die „Fußläufigkeit“ von öffent-
lich zugänglicher Normalladeinfrastruktur, größere Distanzen die über das Quartier hin-
ausreichende Erreichbarkeit von Schnellladeinfrastruktur und HPC.
Anschließend werden die Ausstrahlungsfaktoren (Tabelle 8) verteilt. Diese geben an, wie
viel Prozent der Ladeleistung innerhalb der ersten 60 Sekunden, zwischen 60 und 120 Se-
kunden und zwischen 120 und 300 Sekunden verteilt werden, differenziert nach Ladeleis-
tungskategorie. Ist der Wert zwischen 120 bis 300 Sekunden zum Beispiel 0,2 für Schnell-
ladepunkte, wird 20 % der aufgebauten Ladeleistung in diesen Wirkungsraum umverteilt.

## TABELLE 8: AUSSTRAHLUNGSFAKTOREN
Bereich NLP SLP
## ≤ 60 0,8 0,5
## 60 − 120 0,2 0,3
## 120 − 300 0,0 0,2

Da es besonders im ländlichen Raum vorkommen kann, dass die nächste Gitterzelle erst
in der 300-Sekunden-Isochrone vorhanden ist, würden die 20 % des Normalladepunktes
verloren gehen. Daher werden die Ausstrahlungsfaktoren auf die vorhandenen Isochro-
nen normierend umverteilt und es kann zu Abweichungen von Tabelle 8 kommen. In
Summe muss aber der Wert je Ladeleistungskategorie 1,0 ergeben, sodass die komplette
Ladeleistung verteilt werden kann.
Ein weiterer Anwendungsfall von Isochronen ergibt sich für die Umverteilung der Ladel-
eistungen in Kapitel 3.2.2.3, die außerhalb des öffentlich befahrbaren Straßennetzes
liegt. Da eine flächendecke Abdeckung mit Isochronen berechnet wird, können dadurch
diese unerreichbaren Gebiete identifiziert werden. Da die Daten des RoutingPlus-Diens-
tes (BKG, 2026) auf OpenStreetMap basieren, können hier Datenfehler auch unerwartete
Ergebnisse erzeugen. Dies zeigt sich zum Beispiel durch geroutete Pkw-Isochronen auf
autofreien Inseln, weswegen die Ladebedarfe auf diesen noch einmal manuell entfernt
wurden.

## DOKUMENTENVERSION 1.0.2






## 39



6.4 Deckelung der Ladeleistung
Gemäß den Vorgaben der Alternative Fuels Infrastructure Regulation (AFIR) ist die maxi-
mal mögliche Leistung einer Ladestation und nicht die Leistung der einzelnen Lade-
punkte zu betrachten (EU, 2023). Diese „Ladestationsbasierte installierte Ladeleistung“
## 푃
## 푚푖푛
berechnet  sich  als  Minimum  aus  Summe  der  Leistung  der  einzelnen  Lade-
punkte 푃
## 퐿푎푑푒푝푢푛푘푡,푖
(mit 푛: allen Ladepunkten der Ladestation) oder aus der Netzan-
schlussleistung limitierten Ladestationsleistung 푃
## 퐿푎푑푒푠푡푎푡푖표푛
## :
## 푃
## 푚푖푛
## =min( 푃
## 퐿푎푑푒푠푡푎푡푖표푛
## ,∑푃
## 퐿푎푑푒푝푢푛푘푡,푖
## 푛
## 푖=1
## )
Da im weiteren Verlauf der Saldorechnung eine Unterscheidung in die Kategorien nach
Ladesäulenverordnung (LSV) wichtig, findet die Deckelung je Ladestation gewichtet nach
Normallade- und Schnellladepunkten statt. In Summe ergeben diese wieder 푃
## 푚푖푛
## .


## 6.5 Änderungen
Version 1.0.2: Vereinheitlichung des Dokumentnamens; Formatierung von Abbildungs-
und Tabellenüberschriften, um die entsprechenden Verzeichnisse übersichtlicher zu hal-
ten.


## DOKUMENTENVERSION 1.0.2






## 40





## IMPRESSUM

## Herausgeber
NOW GmbH
## Fasanenstraße 5
## 10623 Berlin


## Kontakt
## Nationale Leitstelle Ladeinfrastruktur
(im Auftrag des BMV und unter dem Dach der NOW GmbH)

ladeinfrastruktur@now-gmbh.de
Website: www.nationale-leitstelle.de

## Stand
10/2026 (Dokumentenversion 1.0.2)

## Zitierhinweis
Nationale Leitstelle Ladeinfrastruktur (NOW GmbH), Hrsg. Methodikbericht Standort-
TOOL Pkw. Berlin, 2026

Die Publikationen der NOW GmbH sind unter der Creative-Commons-Lizenz CC BY-NC-ND 4.0 lizenziert.



