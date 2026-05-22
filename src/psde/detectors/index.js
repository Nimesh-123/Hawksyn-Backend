/**
 * Master PSDE Detector Registry
 * Aggregates all categorized detectors for the scanning engine.
 */

const growth = require('./growth');
const tenure = require('./tenure');
const impactLeadership = require('./impact_leadership');
const execution = require('./execution');
const risk = require('./risk');
const domain = require('./domain');
const industry = require('./industry');
const behavioral = require('./behavioral');
const contextual = require('./contextual');
const specialization = require('./specialization');
const financialCrisis = require('./financial_crisis');
const engineeringCulture = require('./engineering_culture');
const productDesign = require('./product_design');
const softSkills = require('./soft_skills');
const governanceCompliance = require('./governance_compliance');
const internationalMobility = require('./international_mobility');
const salesRevenue = require('./sales_revenue');
const customerSuccess = require('./customer_success');
const hrPeople = require('./hr_people');
const financeControl = require('./finance_control');
const legalIP = require('./legal_ip');
const supplyChain = require('./supply_chain');
const marketingBrand = require('./marketing_brand');
const dataAI = require('./data_ai');
const supportService = require('./support_service');
const governancePMO = require('./governance_pmo');
const executivePresence = require('./executive_presence');
const strategicAlliances = require('./strategic_alliances');
const productOpsGrowth = require('./product_ops_growth');
const engineeringLeadership = require('./engineering_leadership');
const advancedArchitecture = require('./advanced_tech_architecture');
const salesRevenueOps = require('./sales_revenue_ops');
const customerSuccessRetention = require('./customer_success_retention');
const creativeUX = require('./creative_ux_leadership');
const legalAdvanced = require('./legal_ip_governance_advanced');
const supplyChainAdvanced = require('./supply_chain_advanced');
const healthTechBiotech = require('./healthtech_biotech');
const esgSocialImpact = require('./esg_social_impact');
const aiEmergingTech = require('./ai_emerging_tech');
const highStakesOps = require('./high_stakes_ops');

module.exports = {
    // --- GROWTH ---
    detectLinearGrowth: growth.detectLinearGrowth,
    detectInternalPromotion: growth.detectInternalPromotion,
    detectAcceleratedGrowth: growth.detectAcceleratedGrowth,
    detectStagnantTrajectory: growth.detectStagnantTrajectory,
    detectEarlyCareerPeak: growth.detectEarlyCareerPeak,
    detectLateBloomer: growth.detectLateBloomer,
    detectMultiLevelJump: growth.detectMultiLevelJump,
    detectInternalMobilitySpecialist: growth.detectInternalMobilitySpecialist,
    detectPivotSuccess: growth.detectPivotSuccess,
    detectPivotStruggle: growth.detectPivotStruggle,
    detectConsistentHighVelocity: growth.detectConsistentHighVelocity,
    detectPlateauRisk: growth.detectPlateauRisk,
    detectPromotionVelocity: growth.detectPromotionVelocity,
    detectFastTrackGrowth: growth.detectFastTrackGrowth,

    // --- TENURE ---
    detectLongTenure: tenure.detectLongTenure,
    detectJobHopper: tenure.detectJobHopper,
    detectCareerConsistency: tenure.detectCareerConsistency,
    detectSectorLoyalist: tenure.detectSectorLoyalist,
    detectSerialContractor: tenure.detectSerialContractor,
    detectBoomerangEmployee: tenure.detectBoomerangEmployee,
    detectShortTenureRisk: tenure.detectShortTenureRisk,
    detectFoundationBuilder: tenure.detectFoundationBuilder,
    detectAnchorTenure: tenure.detectAnchorTenure,
    detectHighMobilitySpecialist: tenure.detectHighMobilitySpecialist,
    detectEarlyExitPattern: tenure.detectEarlyExitPattern,

    // --- LEADERSHIP & IMPACT ---
    detectQuantifiedImpact: impactLeadership.detectQuantifiedImpact,
    detectHighPerformanceCulture: impactLeadership.detectHighPerformanceCulture,
    detectLeadershipDensity: impactLeadership.detectLeadershipDensity,
    detectBudgetOwner: impactLeadership.detectBudgetOwner,
    detectPandLResponsibility: impactLeadership.detectPandLResponsibility,
    detectGlobalStakeholderMgmt: impactLeadership.detectGlobalStakeholderMgmt,
    detectMentorshipProfile: impactLeadership.detectMentorshipProfile,
    detectTeamBuilder: impactLeadership.detectTeamBuilder,
    detectStakeholderNavigator: impactLeadership.detectStakeholderNavigator,
    detectCrossFunctionalLeader: impactLeadership.detectCrossFunctionalLeader,
    detectExecutiveOwnership: impactLeadership.detectExecutiveOwnership,
    detectRevenueDriver: impactLeadership.detectRevenueDriver,
    detectEfficiencyExpert: impactLeadership.detectEfficiencyExpert,

    // --- EXECUTION ---
    detectTransformationSpecialist: execution.detectTransformationSpecialist,
    detectStrategicExecution: execution.detectStrategicExecution,
    detectMarqueeProjectAssociation: execution.detectMarqueeProjectAssociation,
    detectCredentialPrestige: execution.detectPrestigeClimber,
    detectTier1Career: execution.detectTier1Career,
    detectTurnaroundSpecialist: execution.detectTurnaroundSpecialist,
    detectScaleUpExpert: execution.detectScaleUpExpert,
    detectGreenfieldProjectLead: execution.detectGreenfieldProjectLead,
    detectMAIntegrationSpecialist: execution.detectMAIntegrationSpecialist,
    detectPostMergerNavigator: execution.detectPostMergerNavigator,
    detectCostOptimisationLead: execution.detectCostOptimisationLead,
    detectDigitalTransformationArchitect: execution.detectDigitalTransformationArchitect,
    detectOperatingModelSpecialist: execution.detectOperatingModelSpecialist,

    // --- RISK ---
    detectOverlappingRoles: risk.detectOverlappingRoles,
    detectCareerGaps: risk.detectCareerGaps,
    detectResponsibilityDeflation: risk.detectResponsibilityDeflation,
    detectTitleInflation: risk.detectTitleInflation,
    detectFrequentSectorSwitching: risk.detectFrequentSectorSwitching,
    detectDomainContamination: risk.detectDomainContamination,
    detectUnstableGrowthPattern: risk.detectUnstableGrowthPattern,
    detectCareerVolatility: risk.detectCareerVolatility,

    // --- DOMAIN ---
    detectDomainDepth: domain.detectDomainDepth,
    detectCrossIndustryExposure: domain.detectCrossIndustryExposure,
    detectHighDomainFluency: domain.detectHighDomainFluency,
    detectRegulatorySpecialist: domain.detectRegulatorySpecialist,
    detectNicheTechnicalDepth: domain.detectNicheTechnicalDepth,
    detectCrossFunctionalBridge: domain.detectCrossFunctionalBridge,
    detectStrategyToExecutionLink: domain.detectStrategyToExecutionLink,
    detectMultiDomainExpert: domain.detectMultiDomainExpert,
    detectGlobalPerspective: domain.detectGlobalPerspective,
    detectNicheDomainSpecialist: domain.detectNicheDomainSpecialist,

    // --- INDUSTRY ---
    detectSaaSExpert: industry.detectSaaSExpert,
    detectFinTechSpecialist: industry.detectFinTechSpecialist,
    detectBFSIVeteran: industry.detectBFSIVeteran,
    detectEcommerceSpecialist: industry.detectEcommerceSpecialist,
    detectManufacturingLead: industry.detectManufacturingLead,
    detectHealthcareDomainExpert: industry.detectHealthcareDomainExpert,
    detectConsumerGoodsExpert: industry.detectConsumerGoodsExpert,

    // --- BEHAVIORAL (New in Batch 4) ---
    detectAnalyticalPowerhouse: behavioral.detectAnalyticalPowerhouse,
    detectCrisisManager: behavioral.detectCrisisManager,
    detectVisionaryLeader: behavioral.detectVisionaryLeader,
    detectMethodicalOperator: behavioral.detectMethodicalOperator,
    detectHighAmbitionSignal: behavioral.detectHighAmbitionSignal,

    // --- CONTEXTUAL (New in Batch 4) ---
    detectStartupNative: contextual.detectStartupNative,
    detectBigTechAlumni: contextual.detectBigTechAlumni,
    detectMatureEnterpriseLeader: contextual.detectMatureEnterpriseLeader,
    detectPublicSectorNavigator: contextual.detectPublicSectorNavigator,
    detectFamilyOfficeProfessional: contextual.detectFamilyOfficeProfessional,

    // --- SPECIALIZATION (New in Batch 5) ---
    detectPLGExpert: specialization.detectPLGExpert,
    detectCapitalAllocationExpert: specialization.detectCapitalAllocationExpert,
    detectProfitabilityDriver: specialization.detectProfitabilityDriver,
    detectCategoryCreator: specialization.detectCategoryCreator,
    detectAgileTransformationLead: specialization.detectAgileTransformationLead,
    detectGTMArchitect: specialization.detectGTMArchitect,

    // --- FINANCIAL & CRISIS (New in Batch 6) ---
    detectCrisisDNA: financialCrisis.detectCrisisDNA,
    detectFinancialLiteracyExpert: financialCrisis.detectFinancialLiteracyExpert,
    detectHypergrowthVeteran: financialCrisis.detectHypergrowthVeteran,
    detectLeanSixSigmaPractitioner: financialCrisis.detectLeanSixSigmaPractitioner,
    detectCapitalEfficiencyLead: financialCrisis.detectCapitalEfficiencyLead,

    // --- ENGINEERING CULTURE (New in Batch 7) ---
    detectDevOpsPioneer: engineeringCulture.detectDevOpsPioneer,
    detectCloudNativeArchitect: engineeringCulture.detectCloudNativeArchitect,
    detectSecurityFirstDeveloper: engineeringCulture.detectSecurityFirstDeveloper,
    detectLegacyModernizer: engineeringCulture.detectLegacyModernizer,
    detectDataDrivenEngineer: engineeringCulture.detectDataDrivenEngineer,

    // --- PRODUCT & DESIGN (New in Batch 8) ---
    detectProductVisionary: productDesign.detectProductVisionary,
    detectDesignThinkingAdvocate: productDesign.detectDesignThinkingAdvocate,
    detectRetentionSpecialist: productDesign.detectRetentionSpecialist,
    detectZeroToOneLead: productDesign.detectZeroToOneLead,
    detectVoCLead: productDesign.detectVoCLead,

    // --- SOFT SKILLS & EQ (New in Batch 9) ---
    detectEmpatheticLeader: softSkills.detectEmpatheticLeader,
    detectConflictNavigator: softSkills.detectConflictNavigator,
    detectResilientOperator: softSkills.detectResilientOperator,
    detectInfluentialCommunicator: softSkills.detectInfluentialCommunicator,
    detectCollaborativeCatalyst: softSkills.detectCollaborativeCatalyst,

    // --- GOVERNANCE & COMPLIANCE (New in Batch 10) ---
    detectGovernanceGuardian: governanceCompliance.detectGovernanceGuardian,
    detectRegulatoryNavigator: governanceCompliance.detectRegulatoryNavigator,
    detectEthicsIntegrityLead: governanceCompliance.detectEthicsIntegrityLead,
    detectPolicyArchitect: governanceCompliance.detectPolicyArchitect,
    detectAuditReadinessExpert: governanceCompliance.detectAuditReadinessExpert,

    // --- INTERNATIONAL & GLOBAL MOBILITY (New in Batch 11) ---
    detectExpatLeader: internationalMobility.detectExpatLeader,
    detectCrossBorderStrategist: internationalMobility.detectCrossBorderStrategist,
    detectEmergingMarketsPioneer: internationalMobility.detectEmergingMarketsPioneer,
    detectMultiNationalOperator: internationalMobility.detectMultiNationalOperator,
    detectGlobalMobilityExpert: internationalMobility.detectGlobalMobilityExpert,

    // --- SALES & REVENUE EXCELLENCE (New in Batch 12) ---
    detectSalesHunter: salesRevenue.detectSalesHunter,
    detectAccountFarmer: salesRevenue.detectAccountFarmer,
    detectRevOpsArchitect: salesRevenue.detectRevOpsArchitect,
    detectChannelStrategyLead: salesRevenue.detectChannelStrategyLead,
    detectHighTicketCloser: salesRevenue.detectHighTicketCloser,

    // --- CUSTOMER SUCCESS & EXPERIENCE (New in Batch 13) ---
    detectRetentionMaster: customerSuccess.detectRetentionMaster,
    detectCXArchitect: customerSuccess.detectCXArchitect,
    detectCustomerAdvocate: customerSuccess.detectCustomerAdvocate,
    detectOnboardingSpecialist: customerSuccess.detectOnboardingSpecialist,
    detectScaleCSM: customerSuccess.detectScaleCSM,

    // --- HR & PEOPLE OPERATIONS (New in Batch 14) ---
    detectTalentArchitect: hrPeople.detectTalentArchitect,
    detectCultureDesigner: hrPeople.detectCultureDesigner,
    detectTotalRewardsSpecialist: hrPeople.detectTotalRewardsSpecialist,
    detectLearningDevelopmentLead: hrPeople.detectLearningDevelopmentLead,
    detectHROpsCompliance: hrPeople.detectHROpsCompliance,

    // --- FINANCE & COMMERCIAL CONTROL (New in Batch 15) ---
    detectFPAStrategist: financeControl.detectFPAStrategist,
    detectCommercialController: financeControl.detectCommercialController,
    detectTreasuryTaxLead: financeControl.detectTreasuryTaxLead,
    detectMADealLead: financeControl.detectMADealLead,
    detectInvestorRelationsExpert: financeControl.detectInvestorRelationsExpert,

    // --- LEGAL & INTELLECTUAL PROPERTY (New in Batch 16) ---
    detectGeneralCounsel: legalIP.detectGeneralCounsel,
    detectIPStrategist: legalIP.detectIPStrategist,
    detectLitigationSpecialist: legalIP.detectLitigationSpecialist,
    detectPrivacyDataEthicsLead: legalIP.detectPrivacyDataEthicsLead,
    detectContractManagementExpert: legalIP.detectContractManagementExpert,

    // --- SUPPLY CHAIN & LOGISTICS (New in Batch 17) ---
    detectSupplyChainOrchestrator: supplyChain.detectSupplyChainOrchestrator,
    detectLogisticsExpert: supplyChain.detectLogisticsExpert,
    detectProcurementPowerhouse: supplyChain.detectProcurementPowerhouse,
    detectInventoryOptimizer: supplyChain.detectInventoryOptimizer,
    detectSustainabilitySupplyChain: supplyChain.detectSustainabilitySupplyChain,

    // --- MARKETING & BRAND STRATEGY (New in Batch 18) ---
    detectBrandArchitect: marketingBrand.detectBrandArchitect,
    detectPerformanceMarketer: marketingBrand.detectPerformanceMarketer,
    detectContentStrategist: marketingBrand.detectContentStrategist,
    detectGrowthMarketer: marketingBrand.detectGrowthMarketer,
    detectPRCommunicationsLead: marketingBrand.detectPRCommunicationsLead,

    // --- DATA SCIENCE & AI INTELLIGENCE (New in Batch 19) ---
    detectAIResearcher: dataAI.detectAIResearcher,
    detectMLEngineer: dataAI.detectMLEngineer,
    detectDataStoryteller: dataAI.detectDataStoryteller,
    detectBigDataArchitect: dataAI.detectBigDataArchitect,
    detectAnalyticsLead: dataAI.detectAnalyticsLead,

    // --- CUSTOMER SUPPORT & SERVICE (New in Batch 20) ---
    detectSupportArchitect: supportService.detectSupportArchitect,
    detectSLAChampion: supportService.detectSLAChampion,
    detectCommunityManager: supportService.detectCommunityManager,
    detectTechnicalSupportLead: supportService.detectTechnicalSupportLead,
    detectSelfServiceExpert: supportService.detectSelfServiceExpert,

    // --- GOVERNANCE & PMO (Batch 21) ---
    detectPMOArchitect: governancePMO.detectPMOArchitect,
    detectAgileCoach: governancePMO.detectAgileCoach,
    detectDeliveryLead: governancePMO.detectDeliveryLead,
    detectRiskComplianceLead: governancePMO.detectRiskComplianceLead,
    detectChangeManagementSpecialist: governancePMO.detectChangeManagementSpecialist,

    // --- EXECUTIVE PRESENCE (Batch 22) ---
    detectBoardAdvisor: executivePresence.detectBoardAdvisor,
    detectPublicSpeaker: executivePresence.detectPublicSpeaker,
    detectESGChampion: executivePresence.detectESGChampion,
    detectIndustryInfluencer: executivePresence.detectIndustryInfluencer,
    detectStrategicAdvisor: executivePresence.detectStrategicAdvisor,

    // --- STRATEGIC ALLIANCES & ECOSYSTEMS (Batch 23) ---
    detectPartnershipArchitect: strategicAlliances.detectPartnershipArchitect,
    detectEcosystemBuilder: strategicAlliances.detectEcosystemBuilder,
    detectMAIntegrationExpert: strategicAlliances.detectMAIntegrationExpert,
    detectJointVentureStrategist: strategicAlliances.detectJointVentureStrategist,
    detectFranchiseExpansionLead: strategicAlliances.detectFranchiseExpansionLead,

    // --- PRODUCT OPERATIONS & GROWTH (Batch 24) ---
    detectProductOpsLead: productOpsGrowth.detectProductOpsLead,
    detectPLGChampion: productOpsGrowth.detectPLGChampion,
    detectDesignSystemArchitect: productOpsGrowth.detectDesignSystemArchitect,
    detectMonetizationStrategist: productOpsGrowth.detectMonetizationStrategist,
    detectABTestingSpecialist: productOpsGrowth.detectABTestingSpecialist,

    // --- ENGINEERING LEADERSHIP (Batch 25) ---
    detectCTOVisionary: engineeringLeadership.detectCTOVisionary,
    detectVPEngineering: engineeringLeadership.detectVPEngineering,
    detectTechnicalCoFounder: engineeringLeadership.detectTechnicalCoFounder,
    detectHeadOfInfrastructure: engineeringLeadership.detectHeadOfInfrastructure,
    detectEngineeringManagerPeople: engineeringLeadership.detectEngineeringManagerPeople,

    // --- ADVANCED TECH ARCHITECTURE (Batch 26) ---
    detectAIMLInfrastructure: advancedArchitecture.detectAIMLInfrastructure,
    detectMicroservicesGuru: advancedArchitecture.detectMicroservicesGuru,
    detectServerlessEvangelist: advancedArchitecture.detectServerlessEvangelist,
    detectEdgeComputingSpecialist: advancedArchitecture.detectEdgeComputingSpecialist,
    detectHighConcurrencyArchitect: advancedArchitecture.detectHighConcurrencyArchitect,

    // --- SALES & REVENUE OPERATIONS (Batch 27) ---
    detectRevOpsStrategist: salesRevenueOps.detectRevOpsStrategist,
    detectGTMEnablementLead: salesRevenueOps.detectGTMEnablementLead,
    detectPricingPackagingModeler: salesRevenueOps.detectPricingPackagingModeler,
    detectSalesTechStackArchitect: salesRevenueOps.detectSalesTechStackArchitect,
    detectTerritoryQuotaPlanner: salesRevenueOps.detectTerritoryQuotaPlanner,

    // --- CUSTOMER SUCCESS & RETENTION (Batch 28) ---
    detectChurnMitigationLead: customerSuccessRetention.detectChurnMitigationLead,
    detectCSOperationsArchitect: customerSuccessRetention.detectCSOperationsArchitect,
    detectStrategicAccountDirector: customerSuccessRetention.detectStrategicAccountDirector,
    detectRenewalsStrategist: customerSuccessRetention.detectRenewalsStrategist,
    detectCSMLeaderScaled: customerSuccessRetention.detectCSMLeaderScaled,

    // --- CREATIVE & UX LEADERSHIP (Batch 29) ---
    detectDesignOpsLead: creativeUX.detectDesignOpsLead,
    detectCreativeDirectorDigital: creativeUX.detectCreativeDirectorDigital,
    detectUserResearchSpecialist: creativeUX.detectUserResearchSpecialist,
    detectServiceDesignArchitect: creativeUX.detectServiceDesignArchitect,
    detectInclusiveDesignChampion: creativeUX.detectInclusiveDesignChampion,

    // --- ADVANCED LEGAL, IP & GOVERNANCE (Batch 30) ---
    detectExportControlSpecialist: legalAdvanced.detectExportControlSpecialist,
    detectLegalTechImplementationLead: legalAdvanced.detectLegalTechImplementationLead,
    detectRegulatoryAffairsDirector: legalAdvanced.detectRegulatoryAffairsDirector,
    detectIPMonetizationStrategist: legalAdvanced.detectIPMonetizationStrategist,
    detectCorporateSecretary: legalAdvanced.detectCorporateSecretary,

    // --- ADVANCED SUPPLY CHAIN & LOGISTICS (Batch 31) ---
    detectColdChainLogisticsLead: supplyChainAdvanced.detectColdChainLogisticsLead,
    detectLastMileOptimizationExpert: supplyChainAdvanced.detectLastMileOptimizationExpert,
    detectStrategicSourcingGlobal: supplyChainAdvanced.detectStrategicSourcingGlobal,
    detectSupplyChainRiskArchitect: supplyChainAdvanced.detectSupplyChainRiskArchitect,
    detectCustomsBrokerageManager: supplyChainAdvanced.detectCustomsBrokerageManager,

    // --- HEALTHTECH & BIOTECH (Batch 32) ---
    detectClinicalOperationsDirector: healthTechBiotech.detectClinicalOperationsDirector,
    detectHealthInformaticsLead: healthTechBiotech.detectHealthInformaticsLead,
    detectMedicalAffairsStrategist: healthTechBiotech.detectMedicalAffairsStrategist,
    detectBioprocessEngineer: healthTechBiotech.detectBioprocessEngineer,
    detectPatientAdvocacyLead: healthTechBiotech.detectPatientAdvocacyLead,

    // --- ESG & SOCIAL IMPACT (Batch 33) ---
    detectESGReportingLead: esgSocialImpact.detectESGReportingLead,
    detectImpactInvestmentAnalyst: esgSocialImpact.detectImpactInvestmentAnalyst,
    detectCorporatePhilanthropyDirector: esgSocialImpact.detectCorporatePhilanthropyDirector,
    detectGrantManagementSpecialist: esgSocialImpact.detectGrantManagementSpecialist,
    detectDEILead: esgSocialImpact.detectDEILead,

    // --- AI & EMERGING TECH (Batch 34) ---
    detectMLOpsEngineer: aiEmergingTech.detectMLOpsEngineer,
    detectVectorDBSpecialist: aiEmergingTech.detectVectorDBSpecialist,
    detectPromptEngineerStrategic: aiEmergingTech.detectPromptEngineerStrategic,
    detectAIEthicsLead: aiEmergingTech.detectAIEthicsLead,
    detectGenAIProductManager: aiEmergingTech.detectGenAIProductManager,
    detectComputerVisionSpecialist: aiEmergingTech.detectComputerVisionSpecialist,
    detectNLPArchitect: aiEmergingTech.detectNLPArchitect,
    detectBlockchainArchitect: aiEmergingTech.detectBlockchainArchitect,
    detectQuantumResearcher: aiEmergingTech.detectQuantumResearcher,
    detectRPALead: aiEmergingTech.detectRPALead,

    // --- HIGH-STAKES OPERATIONS (Batch 35 & 36) ---
    detectDisasterRecoveryArchitect: highStakesOps.detectDisasterRecoveryArchitect,
    detectCrisisCommunicationsLead: highStakesOps.detectCrisisCommunicationsLead,
    detectPhysicalSecurityDirector: highStakesOps.detectPhysicalSecurityDirector,
    detectOHSLead: highStakesOps.detectOHSLead,
    detectFraudPreventionSpecialist: highStakesOps.detectFraudPreventionSpecialist,
    detectCorporateIntelligenceAnalyst: highStakesOps.detectCorporateIntelligenceAnalyst,
    detectProcurementEthicsAuditor: highStakesOps.detectProcurementEthicsAuditor,
    detectGlobalMobilityTaxLead: highStakesOps.detectGlobalMobilityTaxLead,
    detectTreasuryRiskManager: highStakesOps.detectTreasuryRiskManager,
    detectInsuranceClaimsDirector: highStakesOps.detectInsuranceClaimsDirector,
    detectInterimManagementSpecialist: highStakesOps.detectInterimManagementSpecialist,
    detectFounderAssociate: highStakesOps.detectFounderAssociate,
    detectGeneralFiller: () => ({ detected: false, confidence: 0, reasoning: 'Generic filler archetype.' })
};

