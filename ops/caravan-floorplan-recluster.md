# Caravan floorplan re-cluster (DRY — no DB writes)

Same 2093 held listings, re-keyed on (make, model, year, **floorplan**).

- old clusters (make,model,year): **1221**
- new clusters (make,model,year,floorplan): **1309** → candidates with weights: **1163**
- (make,model,year) groups that SPLIT into ≥2 floorplans: **72**
- of those, ≥200 kg ATM disagreement between floorplans: **32**
- unresolved slugs: 674

## Worked examples — model-years where floorplans had been merged to one median

| make | model | year | ATM spread (kg) | floorplans |
|---|---|---|---|---|
| Bruder | Exp | 2021 | 1500 | 4=1600, 6=3100 |
| Bruder | Exp | 2022 | 1250 | 4=1850, 6=3100 |
| Retreat | Hamilton | 2017 | 1100 | None=4300, 216r=3200 |
| Jayco | Sterling | 2013 | 934 | None=3111, 21-65=2660, 25-72=3012, 5-17-55-3=2177 |
| Jayco | Starcraft | 2015 | 917 | None=2547, 15-48-4=1630, 5-19-61-2=2485 |
| Jayco | Sterling | 2007 | 868 | None=1930, 2=2798 |
| River Caravans | Dominator | 2019 | 750 | 5=2750, 6=3500 |
| Victory Caravans | Trophy | 2025 | 700 | None=3500, 176=2800, 186=3500, 196=?, 216=3500, 22=3500 |
| Willow RV | Boab | 2022 | 600 | 5-5529=3200, 5224=2600, 6-621=3200 |
| Supreme | Spirit | 2012 | 591 | None=3500, 2=2909 |
| Olympic | Marathon | 2016 | 585 | 5-c176-1=2070, 5-c180-1=?, 5-c196-3-1=2655 |
| Jayco | Discovery | 2009 | 539 | None=1507, 2=2046 |
| Legend Caravans | Groundbreaker | 2019 | 500 | 19f-6i=3500, 23f=4000 |
| Supreme | Classic | 2017 | 494 | None=2704, 2=2210 |
| Coromal | Magnum | 2010 | 470 | None=1600, 2=2070 |
| Coromal | Element | 2013 | 450 | None=2500, 542=2050 |
| Coromal | Element | 2018 | 430 | None=2956, 612=2526 |
| Jayco | Sterling | 2008 | 415 | None=2113, 21-65=2528 |
| Newlands | Luxe | 2023 | 410 | 6-628=2900, 6-675=3310 |
| Jayco | Journey | 2023 | 393 | None=1881, 2=2274, 3=1970 |
| Jayco | Starcraft Single Bed | 2014 | 385 | 19-61=2595, 19-61-2=2210 |
| Coromal | Princeton | 2007 | 380 | None=2120, 2=2470, 751=2500 |
| Jayco | Sterling | 2011 | 347 | 21-65=2662, 21-65-2=3000, 21-65-3=2653 |
| Jayco | Expanda | 2006 | 341 | None=1430, 16-49=1771 |
| Kimberley Kamper | Kruiser | 2020 | 330 | 6-s2=2920, 6-t3=2590 |
| Condor | Ultimate | 2022 | 300 | None=3200, 6=2900 |
| Coromal | Princeton | 2012 | 285 | None=3430, 667=3145 |
| Jayco | Sterling | 2010 | 264 | None=2536, 19-65-4=2374, 2=2638 |
| Coromal | Princeton | 2004 | 250 | 703=2650, 752=2400 |
| Jayco | Silverline | 2014 | 248 | None=2988, 25-78=3236 |
| Jayco | Discovery | 2011 | 205 | None=1842, 17-55=2047 |
| Network RV Carav | Terrain Tuff | 2021 | 200 | 6-22-2=3500, 7-24=3700 |
