const { db } = require('../../models/index.model');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const hipService = require('./hip.service');

let sectionCounter = 1;

Handlebars.registerHelper('resetCounter', function() {
    sectionCounter = 1;
    return '';
});

Handlebars.registerHelper('padSectionNumber', function() {
    return (sectionCounter++).toString().padStart(2, '0');
});

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

            if (profile.status !== 'PUBLISHED') {
                return res.status(200).send(`
                <html>
                    <body style="background:#080808;color:#f0f0f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                        <div style="text-align:center;padding:20px;border:1px solid #333;border-radius:12px;background:#111;">
                            <h2 style="color:#f0a030;margin-top:0;">Profile Paused</h2>
                            <p style="color:#888;">This Hawksyn Intelligence Profile is currently not visible.</p>
                        </div>
                    </body>
                </html>
                `);
            }

            // Fetch extra collections directly in the API for dynamic PROFILE rendering
            const userProfile = await db.UserProfile.findOne({ userId: profile.userId });
            const cvData = userProfile?.confirmedProfile || userProfile?.originalParsedData || {};
            const psdeResult = await db.PSDEResult.findOne({ candidate_id: profile.userId }).lean() || {};
            const userDoc = await db.User.findById(profile.userId).lean();

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
                    partial_matches: psdeResult.total_partial || '5', // From PSDE
                    profilePhoto: userDoc?.profilePhoto ? `/api/v1/user/profile-photo/${profile.userId}` : null
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
            const userId = req.body.userId || req.user?.id; 
            if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

            let profile = await db.HipProfile.findOne({ userId });
            if (!profile) {
                profile = new db.HipProfile({
                    userId,
                    runId: `run-${Date.now()}`,
                    profileSlug: `hip-${userId}-${Date.now()}`,
                    status: 'DRAFT',
                    generationStatus: 'CAREER_SIGNALS'
                });
                await profile.save();
            } else {
                profile.generationStatus = 'CAREER_SIGNALS';
                profile.status = 'DRAFT';
                await profile.save();
            }

            // Start background process
            generateHipProfileWithSteps(userId);

            res.json({ 
                success: true, 
                status: 'CAREER_SIGNALS'
            });
        } catch (error) {
            console.error('Generation Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getHipStatus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const profile = await db.HipProfile.findOne({ userId }).lean();
            if (!profile) {
                return res.status(200).json({ success: true, status: 'PENDING' });
            }

            let responsePayload = { success: true, status: profile.generationStatus };

            if (profile.generationStatus === 'COMPLETED') {
                const psdeResult = await db.PSDEResult.findOne({ candidate_id: userId }).lean() || {};
                const userProfile = await db.UserProfile.findOne({ userId }).lean() || {};
                const parsedCV = userProfile.confirmedProfile || userProfile.originalParsedData || {};
                
                // Try to extract top signal from S02, else default
                let topSignal = 'You grew faster than most people at your level';
                if (profile.sectionsData instanceof Map && profile.sectionsData.has('S02')) {
                    const s02 = profile.sectionsData.get('S02');
                    if (s02 && s02.top_signal) topSignal = s02.top_signal;
                } else if (profile.sectionsData && profile.sectionsData.S02) {
                    topSignal = profile.sectionsData.S02.top_signal || topSignal;
                }

                responsePayload.profileSlug = profile.profileSlug;
                responsePayload.isLive = profile.status === 'PUBLISHED';
                const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3002}/api/v1`;
                responsePayload.shareUrl = `${baseUrl}/hip/public/profile/${profile.profileSlug}`;
                responsePayload.profileData = {
                    // Original fields in case they are needed elsewhere
                    fullName: profile.seoMetadata?.jsonLdPerson?.name || "User",
                    jobTitle: profile.seoMetadata?.jsonLdPerson?.jobTitle || "Professional",
                    tag: parsedCV.structured?.inferred?.industry || parsedCV.inferred?.industry || "Strategist",
                    topSignal: topSignal,
                    signalCount: psdeResult.total_detected || 14,
                    clockCount: 4,
                    verified: !!profile.publishedAt
                };
            }

            return res.status(200).json(responsePayload);
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    async toggleHipStatus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const profile = await db.HipProfile.findOne({ userId });
            if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

            profile.status = profile.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
            await profile.save();

            return res.status(200).json({ 
                success: true, 
                message: `Profile is now ${profile.status === 'PUBLISHED' ? 'Live' : 'Paused'}`,
                isLive: profile.status === 'PUBLISHED',
                status: profile.status
            });
        } catch (error) {
            console.error('Error toggling HIP status:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }


    async downloadHipPdf(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const profile = await db.HipProfile.findOne({ userId });
            if (!profile) {
                return res.status(404).json({ success: false, message: 'Profile not found' });
            }

            const userProfile = await db.UserProfile.findOne({ userId: profile.userId });
            const cvData = userProfile?.confirmedProfile || userProfile?.originalParsedData || {};
            const psdeResult = await db.PSDEResult.findOne({ candidate_id: profile.userId }).lean() || {};
            const userDoc = await db.User.findById(profile.userId).lean();

            const templatePath = path.join(__dirname, 'HIP_Template_PDF.hbs');
            if (!fs.existsSync(templatePath)) {
                return res.status(500).json({ success: false, message: "Template missing on server" });
            }
            const rawHtml = fs.readFileSync(templatePath, 'utf8');
            const template = Handlebars.compile(rawHtml);
            
            let profilePhotoBase64 = null;
            if (userDoc?.profilePhoto || userDoc?.avatar) {
                try {
                    const photoUrl = `${req.protocol}://${req.get('host')}/api/v1/user/profile-photo/${profile.userId}`;
                    const resFetch = await fetch(photoUrl);
                    if (resFetch.ok) {
                        const buffer = await resFetch.arrayBuffer();
                        const contentType = resFetch.headers.get('content-type') || 'image/png';
                        profilePhotoBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
                    }
                } catch (e) {
                    console.error('Failed to fetch profile photo for PDF', e);
                }
            }
            
            const viewData = {
                isPdf: true,
                META: {
                    canonical_url: profile.seoMetadata?.canonicalUrl,
                    og_image_url: profile.seoMetadata?.ogImageUrl,
                    description: profile.seoMetadata?.metaDescription,
                    og_description: profile.seoMetadata?.metaDescription,
                    favicon_url: 'https://hawksyn.com/favicon.ico',
                    apple_touch_icon_url: 'https://hawksyn.com/apple-touch-icon.png',
                    locale: 'en_IN'
                },
                PROFILE: {
                    full_name: profile.seoMetadata?.jsonLdPerson?.name,
                    first_name: profile.seoMetadata?.jsonLdPerson?.name?.split(' ')[0],
                    last_name: profile.seoMetadata?.jsonLdPerson?.name?.split(' ')?.slice(1)?.join(' '),
                    current_title: profile.seoMetadata?.jsonLdPerson?.jobTitle,
                    linkedin_url: cvData?.structured?.identity?.social_links?.linkedin || profile.seoMetadata?.jsonLdPerson?.sameAs || '',
                    primary_domain: cvData?.structured?.inferred?.industry || cvData?.inferred?.industry || cvData.domain || 'Technology', 
                    traits_evaluated: psdeResult.total_evaluated || '330', 
                    strong_signals: psdeResult.total_detected || '3', 
                    years_experience: Math.round(cvData?.structured?.inferred?.totalExperienceYears || cvData?.inferred?.totalExperienceYears) || cvData.yearsOfExperience || '8',
                    rarity_score: profile.seoMetadata?.rarityScore || 95,
                    partial_matches: psdeResult.total_partial || '5',
                    profilePhoto: profilePhotoBase64
                },
                CERT: {
                    run_id: profile.runId,
                    date_verified: profile.publishedAt ? profile.publishedAt.toISOString() : new Date().toISOString()
                },
                PSDE: {
                    rarity_score: profile.seoMetadata?.rarityScore
                },
                hip: {}
            };

            const sections = profile.sectionsData instanceof Map ? Object.fromEntries(profile.sectionsData) : (profile.sectionsData || {});
            for (const [secId, data] of Object.entries(sections)) {
                const lowerId = secId.toLowerCase();
                viewData.hip[lowerId] = data;
            }

            const finalHtml = template(viewData);

            const puppeteer = require('puppeteer');
            const browser = await puppeteer.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            
            await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
            
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
            });
            
            await browser.close();

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Hawksyn-HIP-${profile.profileSlug || 'Profile'}.pdf`);
            return res.send(Buffer.from(pdfBuffer));
            
        } catch (error) {
            console.error('Error generating HIP PDF:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

}

// Background Task Function
const generateHipProfileWithSteps = async (userId) => {
    try {
        const socketService = require('../../sockets/socketService');
        const emitUpdate = (status) => {
            const io = socketService.getIO();
            if (io) io.to(userId.toString()).emit('hip_generation_update', { status });
        };

        await db.HipProfile.updateOne({ userId }, { generationStatus: 'CAREER_SIGNALS' });
        emitUpdate('CAREER_SIGNALS');
        await new Promise(resolve => setTimeout(resolve, 2500));

        await db.HipProfile.updateOne({ userId }, { generationStatus: 'CLOCK_DATA' });
        emitUpdate('CLOCK_DATA');
        await new Promise(resolve => setTimeout(resolve, 2500));

        await db.HipProfile.updateOne({ userId }, { generationStatus: 'PROFILE_CARD' });
        emitUpdate('PROFILE_CARD');
        await new Promise(resolve => setTimeout(resolve, 2500));

        await db.HipProfile.updateOne({ userId }, { generationStatus: 'SECURE_PIN' });
        emitUpdate('SECURE_PIN');
        
        // Heavy generation
        const profile = await hipService.generateHipProfile(userId);

        await db.HipProfile.updateOne(
            { userId }, 
            { generationStatus: 'COMPLETED', status: 'PUBLISHED', publishedAt: new Date(), profileSlug: profile.profileSlug }
        );
        emitUpdate('COMPLETED');

    } catch (error) {
        console.error('Background HIP Generation Error:', error);
        await db.HipProfile.updateOne({ userId }, { generationStatus: 'PENDING' });
    }
};

module.exports = new HipController();
