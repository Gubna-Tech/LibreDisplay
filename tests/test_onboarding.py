import re
import unittest
from pathlib import Path
from frontend_source import frontend_source

ROOT = Path(__file__).resolve().parents[1]
HTML = frontend_source(ROOT)
README = (ROOT / 'README.md').read_text(encoding='utf-8')


class OnboardingTests(unittest.TestCase):
    def test_wizard_covers_guided_setup_milestones(self):
        m = re.search(r"const WIZARD_STEPS=\[(.*?)\n\];", HTML, re.S)
        self.assertIsNotNone(m)
        keys = re.findall(r"key:'([^']+)'", m.group(1))
        self.assertEqual(keys, [
            'welcome', 'display', 'location', 'calendar', 'background', 'performance',
            'alerts', 'appearance', 'remote', 'backup', 'review', 'health'
        ])

    def test_wizard_uses_real_settings_sections(self):
        self.assertIn('#setup.wizard-mode .settings-workspace { display:block !important;', HTML)
        self.assertIn('#setup.wizard-mode .settings-sidebar { display:none !important;', HTML)
        self.assertNotIn('#setup.wizard-mode .settings-workspace { display:none !important;', HTML)
        self.assertIn("sections:['settings-location','settings-weather-options']", HTML)
        self.assertIn("sections:['settings-calendars']", HTML)
        self.assertIn("sections:['settings-backgrounds']", HTML)
        self.assertIn("sections:['settings-alerts']", HTML)
        self.assertIn("sections:['settings-theme']", HTML)
        self.assertIn("sections:['settings-remote']", HTML)


    def test_performance_wizard_is_opt_in_and_explains_heavy_features(self):
        self.assertIn("key:'performance'", HTML)
        self.assertIn('Recommended for Pi 3 / low-end devices', HTML)
        self.assertIn('Fullscreen weather atmosphere', HTML)
        self.assertIn('Seasonal wildlife &amp; atmosphere', HTML)
        self.assertIn('Animated / video backgrounds', HTML)
        self.assertIn('Preload next background', HTML)
        self.assertIn("lightweight:{widget:false,overlay:false,seasonal:false,motionBg:false,preload:false}", HTML)
        self.assertIn("immersive:{widget:true,overlay:true,seasonal:true,motionBg:true,preload:true}", HTML)

    def test_fresh_install_defaults_are_lightweight(self):
        self.assertIn('photoPreload:false', HTML)
        self.assertIn('weatherWidgetAnimations:false', HTML)
        self.assertIn("weatherSeasonalEffects:false,weatherSeasonMode:'auto'", HTML)
        self.assertIn('backgroundMotionEnabled:null', HTML)
        self.assertIn("cfg.backgroundMotionEnabled=cfg.onboardingComplete===true", HTML)
        self.assertIn("cfg.photoPreload=cfg.onboardingComplete===true", HTML)

    def test_display_name_is_deferred_until_save(self):
        self.assertIn('wizardDisplayNameDraft', HTML)
        self.assertIn('async function wizardCommitDisplayName()', HTML)
        self.assertIn("endpointAction({action:'rename',id:bootstrapApi.ACTIVE_ENDPOINT,name})", HTML)
        review = re.search(r'async function wizardSaveAndRunChecks\(\)\{(.*?)\n\}', HTML, re.S)
        self.assertIsNotNone(review)
        body = review.group(1)
        self.assertIn("saveSetup({closeAfter:false})", body)
        self.assertIn('wizardCommitDisplayName()', body)
        self.assertLess(body.index('saveSetup({closeAfter:false})'), body.index('wizardCommitDisplayName()'))

    def test_verified_weather_location_remains_required(self):
        wizard_next = re.search(r'async function wizardNext\(\)\{(.*?)\n\}', HTML, re.S)
        self.assertIsNotNone(wizard_next)
        self.assertIn("if(step.key==='location')", wizard_next.group(1))
        self.assertIn('choose the exact city/region/country match', wizard_next.group(1))

    def test_setup_baseline_is_created_after_saved_configuration(self):
        self.assertIn('Create a private “Initial setup baseline” restore point after saving', HTML)
        self.assertIn("label:'Initial setup baseline'", HTML)
        flow = re.search(r'async function wizardSaveAndRunChecks\(\)\{(.*?)\n\}', HTML, re.S).group(1)
        self.assertLess(flow.index('saveSetup({closeAfter:false})'), flow.index('wizardCreateSetupBaseline()'))

    def test_final_health_check_is_real_and_repeatable(self):
        self.assertIn('async function runWizardHealthChecks()', HTML)
        self.assertIn('refreshProviderHealth(true)', HTML)
        self.assertIn('loadSystemHealth()', HTML)
        self.assertIn('loadRemoteInfo()', HTML)
        self.assertIn('checkSoftwareUpdate(false)', HTML)
        self.assertIn('Run checks again', HTML)

    def test_save_setup_supports_wizard_transaction_without_closing(self):
        self.assertIn('async function saveSetup(options={})', HTML)
        self.assertIn("if(options?.closeAfter!==false)closeSetup(false);", HTML)
        self.assertIn('const persistence=await saveCfg();', HTML)
        self.assertIn('return {ok:true,persistence};', HTML)

    def test_readme_documents_first_run_setup_without_internal_detail(self):
        self.assertIn('setup wizard automatically', README)
        self.assertIn('display name', README)
        self.assertIn('weather location', README)
        self.assertIn('Settings > Home > Run setup wizard', README)


if __name__ == '__main__':
    unittest.main()
