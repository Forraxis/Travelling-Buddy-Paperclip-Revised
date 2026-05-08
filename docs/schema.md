# TravellingBuddy Database Schema

Phase 1 complete schema — 22 models, 21 enums, 8 migrations.

## Entity Relationship Overview

```
VehicleMake 1──* VehicleModel 1──* VehicleVariant
CaravanMake 1──* CaravanModel 1──* CaravanVariant

AccessoryBrand 1──* Accessory *──1 AccessoryCategory
                                   (self-referencing hierarchy)

AccessoryFitment *──1 Accessory
AccessoryFitment *──? VehicleVariant
AccessoryFitment *──? CaravanVariant
  (CHECK: exactly one variant must be set)
AccessoryFitment *──? User (verifiedBy)

User 1──* Account
User 1──* Session
User 1──* Setup

Setup *──? VehicleVariant
Setup *──? CaravanVariant
Setup 1──* SetupAccessory ──1 AccessoryFitment (self-referencing hierarchy)
Setup 1──* SetupCaravanAccessory ──1 AccessoryFitment (self-referencing hierarchy)
Setup 1──* SetupCustomLoad

VehicleSubmission *──1 User (submitter)
VehicleSubmission *──? User (decidedBy)
VehicleSubmission *──? VehicleVariant (resulting)

CaravanSubmission *──1 User (submitter)
CaravanSubmission *──? User (decidedBy)
CaravanSubmission *──? CaravanVariant (resulting)

AccessorySubmission *──1 User (submitter)
AccessorySubmission *──? User (decidedBy)
AccessorySubmission *──? AccessoryBrand
AccessorySubmission *──? AccessoryCategory
AccessorySubmission *──? VehicleVariant / CaravanVariant (appliesTo)
AccessorySubmission *──? Accessory / AccessoryFitment (resulting)

Sponsor 1──* SponsoredPlacement
SponsoredPlacement *──? Accessory
SponsoredPlacement *──? AccessoryCategory

RegulationSet (self-referencing hierarchy via parentSetCode)

AuditLog *──1 User (changedBy)
ModerationAction *──1 User (moderator)
```

## Models

### Vehicle Domain

| Model | Description | Key Fields |
|-------|-------------|------------|
| **VehicleMake** | Vehicle manufacturers | name (unique), slug (unique), countryOfOrigin |
| **VehicleModel** | Model lines per make | makeId (FK), bodyType (enum), unique(makeId, slug) |
| **VehicleVariant** | Year-range specific variants | yearFrom/yearTo, GVM/GCM/kerb weights, towing capacity, fuel type, market |

### Caravan Domain

| Model | Description | Key Fields |
|-------|-------------|------------|
| **CaravanMake** | Caravan manufacturers | name (unique), slug (unique), countryOfOrigin |
| **CaravanModel** | Model lines per make | makeId (FK), bodyType (enum), unique(makeId, slug) |
| **CaravanVariant** | Year-range specific variants | ATM/GTM/tare/TBM weights, axle config, water capacities, market |

### Accessory Domain

| Model | Description | Key Fields |
|-------|-------------|------------|
| **AccessoryBrand** | Accessory manufacturers | name (unique), slug (unique), status, isPartner |
| **AccessoryCategory** | Hierarchical categories | parentId (self-ref), displayOrder, iconName |
| **Accessory** | Individual accessories | brandId, categoryId, priceMin/Max, status, market |
| **AccessoryFitment** | How an accessory fits a vehicle/caravan | installedWeightKg, mountingLocation, CoG offsets, confidence, source |

### User & Auth

| Model | Description | Key Fields |
|-------|-------------|------------|
| **User** | Application users | email (unique), role, homeState, trustTier |
| **Account** | OAuth provider accounts | userId (FK), provider, providerAccountId, unique(provider, providerAccountId) |
| **Session** | Active sessions | sessionToken (unique), userId (FK), expires |
| **VerificationToken** | Email verification | unique(identifier, token) |

### Setup (Weight Calculator)

| Model | Description | Key Fields |
|-------|-------------|------------|
| **Setup** | User's vehicle+caravan configuration | vehicleVariantId, caravanVariantId, passengers, cargo, fuel/water %, regulationSetCode |
| **SetupAccessory** | Vehicle accessories in a setup | fitmentId (FK), parentId (self-ref hierarchy), quantityOverride, fillPercent |
| **SetupCaravanAccessory** | Caravan accessories in a setup | fitmentId (FK), parentId (self-ref hierarchy), quantityOverride, fillPercent |
| **SetupCustomLoad** | Free-form weight entries | weightKg, mountingLocation, CoG offsets |

### Community Submissions

| Model | Description | Key Fields |
|-------|-------------|------------|
| **VehicleSubmission** | User-submitted vehicle data | submitterId, status, submittedData (JSON), compliancePlatePhotoUrl |
| **CaravanSubmission** | User-submitted caravan data | submitterId, status, submittedData (JSON), compliancePlatePhotoUrl |
| **AccessorySubmission** | User-submitted accessory data | submitterId, brandId, categoryId, submittedData (JSON) |

### Sponsorship & Advertising

| Model | Description | Key Fields |
|-------|-------------|------------|
| **Sponsor** | Advertising sponsors | name (unique), contactEmail, status |
| **SponsoredPlacement** | Ad placement configuration | sponsorId, placementType, tier, startsAt/endsAt, filters |

### Compliance & Governance

| Model | Description | Key Fields |
|-------|-------------|------------|
| **RegulationSet** | Regulation rule sets (AU ADR, etc.) | code (unique), rules (JSON), market, parentSetCode (self-ref) |
| **AuditLog** | Entity change audit trail | entityType, entityId, action, changedBy, changes (JSON) |
| **ModerationAction** | Submission moderation log | submissionType, submissionId, moderatorId, action |

## Enums (21 total)

| Enum | Values | Used By |
|------|--------|---------|
| VehicleBodyType | DUAL_CAB_UTE, SINGLE_CAB_UTE, EXTRA_CAB_UTE, WAGON, SUV, VAN, TROOPCARRIER, OTHER | VehicleModel, SponsoredPlacement |
| FuelType | DIESEL, PETROL, HYBRID, ELECTRIC | VehicleVariant |
| Market | AU, NZ, US, EU, GB | VehicleVariant, CaravanVariant, Accessory, RegulationSet |
| CaravanBodyType | CARAVAN_POP_TOP, CARAVAN_FULL_HEIGHT, OFF_ROAD_CARAVAN, CAMPER_TRAILER, HYBRID, FIFTH_WHEELER, OTHER | CaravanModel |
| AxleConfiguration | SINGLE_AXLE, DUAL_AXLE_CLOSE_COUPLED, DUAL_AXLE_SPREAD, TRIPLE_AXLE | CaravanVariant |
| BrandStatus | ACTIVE, INACTIVE | AccessoryBrand |
| AccessoryStatus | ACTIVE, DISCONTINUED, PLACEHOLDER | Accessory |
| UserRole | ADMIN, MODERATOR, CONTRIBUTOR, VIEWER | User |
| AustralianState | NSW, VIC, QLD, WA, SA, TAS, NT, ACT | User, SponsoredPlacement |
| TrustTier | NEW, BASIC, TRUSTED, EXPERT | User |
| MountingLocation | 51 values (chassis, tray, canopy, cabin, caravan locations) | AccessoryFitment, SetupCustomLoad |
| PositionType | FIXED, ADJUSTABLE, MODULAR, SLIDING | AccessoryFitment |
| FitmentConfidence | VERIFIED, MANUFACTURER_SPEC, COMMUNITY, ESTIMATED | AccessoryFitment |
| FitmentSource | OEM, AFTERMARKET_VERIFIED, USER_SUBMITTED, CALCULATED | AccessoryFitment |
| RegulationSetCode | AU_ADR, NZ_VIRM, US_FMVSS, EU_UNECE, GB_IVA | Setup |
| SubmissionStatus | PENDING, APPROVED, REJECTED | VehicleSubmission, CaravanSubmission, AccessorySubmission |
| SponsorStatus | ACTIVE, PAUSED, EXPIRED | Sponsor |
| PlacementType | ACCESSORY_FEATURED, CATEGORY_TOP, RECOMMENDATION_PINNED, VEHICLE_TYPE_FEATURED | SponsoredPlacement |
| PlacementTier | FEATURED_FIT, CATEGORY_TOP, RECOMMENDATION_PINNED | SponsoredPlacement |
| AuditAction | CREATE, UPDATE, DELETE | AuditLog |
| ModerationActionType | APPROVE, REJECT, REQUEST_INFO | ModerationAction |

## Custom Constraints

| Constraint | Table | Description |
|-----------|-------|-------------|
| `chk_exactly_one_variant` | AccessoryFitment | Exactly one of vehicleVariantId or caravanVariantId must be set |
| `year_range_valid` | VehicleVariant | yearTo >= yearFrom |
| `caravan_year_range_valid` | CaravanVariant | yearTo >= yearFrom |
| `no_overlapping_year_ranges` | VehicleVariant | GiST exclusion: no overlapping year ranges per (modelId, name) |
| `no_overlapping_caravan_year_ranges` | CaravanVariant | GiST exclusion: no overlapping year ranges per (modelId, name) |

## Migrations

| # | Timestamp | Name | Description |
|---|-----------|------|-------------|
| 1 | 20260508030857 | vehicle_entities_year_range | VehicleMake, VehicleModel, VehicleVariant + year range constraints |
| 2 | 20260508040509 | accessory_base_entities | AccessoryBrand, AccessoryCategory, Accessory |
| 3 | 20260508041100 | user_entities | User, Account, Session, VerificationToken |
| 4 | 20260508120000 | caravan_entities_year_range | CaravanMake, CaravanModel, CaravanVariant + year range constraints |
| 5 | 20260508150000 | accessory_fitments | AccessoryFitment with mounting locations and fitment data |
| 6 | 20260508160000 | setup_entities | Setup, SetupAccessory, SetupCaravanAccessory, SetupCustomLoad |
| 7 | 20260508170000 | submission_entities | VehicleSubmission, CaravanSubmission, AccessorySubmission |
| 8 | 20260508180000 | sponsor_regulation_audit_moderation | Sponsor, SponsoredPlacement, RegulationSet, AuditLog, ModerationAction |

## Cascade / Delete Behavior

| Relationship | On Delete |
|-------------|-----------|
| Make -> Model -> Variant | CASCADE (full chain) |
| Brand -> Accessory | CASCADE |
| Category -> Accessory | RESTRICT |
| Accessory -> Fitment | CASCADE |
| Fitment -> Vehicle/CaravanVariant | CASCADE |
| Fitment -> verifiedBy (User) | SET NULL |
| User -> Account, Session | CASCADE |
| User -> Setup | CASCADE |
| Setup -> SetupAccessory, SetupCaravanAccessory, SetupCustomLoad | CASCADE |
| SetupAccessory -> parent | SET NULL |
| Submission -> submitter (User) | CASCADE |
| Submission -> decidedBy (User) | SET NULL |
| Sponsor -> SponsoredPlacement | CASCADE |
| AuditLog -> changedBy (User) | RESTRICT |
| ModerationAction -> moderator (User) | RESTRICT |
