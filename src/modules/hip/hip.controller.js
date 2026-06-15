const { db } = require('../../models/index.model');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const hipService = require('./hip.service');

class HipController {
    // SSR Route: Render and serve public HIP Profile HTML
    async getPublicProfile(req, res) {
        try {
            const { slug } = req.params;
            
            // 1. Fetch hip profile from DB
            const profile = await db.HipProfile.findOne({ profileSlug: slug });
            if (!profile) {
                return res.status(404).send("<html><body><h1>Profile Not Found</h1><p>The requested Hawksyn Intelligence Profile does not exist or has been removed.</p></body></html>");
            }

            // Fetch extra collections directly in the API for dynamic PROFILE rendering
            const userProfile = await db.UserProfile.findOne({ userId: profile.userId });
            const cvData = userProfile?.confirmedProfile || userProfile?.originalParsedData || {};
            const psdeResult = await db.PSDEResult.findOne({ candidate_id: profile.userId }).lean() || {};

            // 2. Load the HTML Wireframe Template
            const templatePath = path.join(__dirname, 'HIP_Template_Dynamic.hbs');
            if (!fs.existsSync(templatePath)) {
                return res.status(500).send("<html><body>Error: Wireframe template missing on server.</body></html>");
            }
            const rawHtml = fs.readFileSync(templatePath, 'utf8');

            // 3. Compile the template using Handlebars
            const template = Handlebars.compile(rawHtml);
            
            // Reconstruct the data structure that the HTML wireframe expects
            // The wireframe likely expects {{META.*}}, {{PROFILE.*}}, and {{hip.s01.cards}} etc.
            // We'll flatten seoMetadata and combine it with sectionsData for the view.
            
            const viewData = {
                META: {
                    canonical_url: profile.seoMetadata.canonicalUrl,
                    og_image_url: profile.seoMetadata.ogImageUrl,
                    description: profile.seoMetadata.metaDescription,
                    og_description: profile.seoMetadata.metaDescription,
                    favicon_url: 'https://hawksyn.com/favicon.ico',
                    apple_touch_icon_url: 'https://hawksyn.com/apple-touch-icon.png',
                    locale: 'en_IN'
                },
                PROFILE: {
                    full_name: profile.seoMetadata.jsonLdPerson.name,
                    first_name: profile.seoMetadata.jsonLdPerson.name.split(' ')[0],
                    last_name: profile.seoMetadata.jsonLdPerson.name.split(' ').slice(1).join(' '),
                    current_title: profile.seoMetadata.jsonLdPerson.jobTitle,
                    linkedin_url: cvData?.structured?.identity?.social_links?.linkedin || profile.seoMetadata.jsonLdPerson.sameAs || '',
                    primary_domain: cvData?.structured?.inferred?.industry || cvData?.inferred?.industry || cvData.domain || 'Technology', // Aggregated from CV
                    traits_evaluated: psdeResult.total_evaluated || '330', // From PSDE
                    strong_signals: psdeResult.total_detected || '3', // From PSDE
                    years_experience: Math.round(cvData?.structured?.inferred?.totalExperienceYears || cvData?.inferred?.totalExperienceYears) || cvData.yearsOfExperience || '8',
                    rarity_score: profile.seoMetadata.rarityScore || 95,
                    partial_matches: psdeResult.total_partial || '5' // From PSDE
                },
                CERT: {
                    run_id: profile.runId,
                    date_verified: profile.publishedAt ? profile.publishedAt.toISOString() : new Date().toISOString()
                },
                PSDE: {
                    rarity_score: profile.seoMetadata.rarityScore
                },
                hip: {}
            };

            // Map sectionsData to hip object
            // For example, if sectionsData['S01'] exists, it maps to hip.s01
            const sections = profile.sectionsData instanceof Map ? Object.fromEntries(profile.sectionsData) : (profile.sectionsData || {});
            for (const [secId, data] of Object.entries(sections)) {
                const lowerId = secId.toLowerCase(); // 'S01' -> 's01'
                viewData.hip[lowerId] = data;
            }

            // 4. Render HTML
            const finalHtml = template(viewData);
            
            // 5. Send raw HTML to the browser/bot
            res.status(200).send(finalHtml);

        } catch (error) {
            console.error('Error serving HIP profile:', error);
            res.status(500).send("<html><body><h1>Server Error</h1><p>An error occurred while rendering the profile.</p></body></html>");
        }
    }

    // Trigger manual generation of a profile (internal/admin)
    async triggerGeneration(req, res) {
        try {
            const { userId } = req.body; 
            if (!userId) return res.status(400).json({ success: false, message: 'userId is required in the body' });

            const profile = await hipService.generateHipProfile(userId);
            
            // Build the full clickable URL to make it easy to test
            const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}/api/v1`;
            const profileUrl = `${baseUrl}/hip/public/profile/${profile.profileSlug}`;

            res.json({ 
                success: true, 
                profileSlug: profile.profileSlug,
                profileUrl: profileUrl 
            });
        } catch (error) {
            console.error('Generation Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new HipController();
