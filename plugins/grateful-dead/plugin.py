import datetime
import hashlib
import html
import json
import re
import time
from urllib.parse import quote, urlencode
from _shared import request_json, plain_text

MANIFEST={"id":"grateful-dead",
 'apiVersion': 1,
 'name': 'Deadhead · Grateful Dead',
 'description': 'Unofficial fan integration for deeply customizable Today in Dead History shows, setlists, sourced member quotes, and '
                'listening suggestions.',
 'version': '1.8',
 'icon': '✺',
 'refreshMin': 30,
 'kind': 'data',
 'actions': ['load-setlist'],
 'category': 'Media',
 'access': 'no-key',
 'freedomNote': 'Setlists prefer JerryBase, then Relisten, then Internet Archive; listening links prefer Internet Archive. These core sources require no LibreDisplay API key or account.',
 'layoutParts': [
     {'key': 'root', 'label': 'Deadhead content canvas', 'selector': '.deadhead-panel', 'root': True, 'container': True, 'movable': False, 'order': 0},
     {'key': 'header', 'label': 'Header', 'selector': '.deadhead-header', 'parent': 'root', 'container': True, 'order': 0, 'visibilitySetting': 'showHeader'},
     {'key': 'browser', 'label': 'Show browser', 'selector': '.deadhead-year-strip,.deadhead-show-list', 'parent': 'root', 'order': 10, 'visibilitySetting': 'showBrowserEnabled'},
     {'key': 'navigation', 'label': 'Show navigation', 'selector': '.deadhead-nav', 'parent': 'root', 'container': True, 'order': 20, 'visibilitySetting': 'showNavigation'},
     {'key': 'show', 'label': 'Featured show details', 'selector': '.deadhead-show', 'parent': 'root', 'container': True, 'order': 30, 'visibilitySetting': 'showShowDetails'},
     {'key': 'weather', 'label': 'Weather listening pick', 'selector': '.deadhead-listen-prompt', 'parent': 'root', 'order': 40, 'visibilitySetting': 'showWeatherPick'},
     {'key': 'setlist', 'label': 'Setlist', 'selector': '.deadhead-setlist', 'parent': 'root', 'container': True, 'order': 50, 'visibilitySetting': 'setlistsEnabled'},
     {'key': 'quote', 'label': 'Quote', 'selector': '.deadhead-quote', 'parent': 'root', 'container': True, 'order': 60, 'visibilitySetting': 'quotesEnabled'},
     {'key': 'footer', 'label': 'Footer', 'selector': '.deadhead-footer', 'parent': 'root', 'container': True, 'order': 70, 'visibilitySetting': 'showFooter'},
     {'key': 'headerIcon', 'label': 'Header icon', 'selector': '.deadhead-mark', 'parent': 'header', 'order': 0},
     {'key': 'headerCopy', 'label': 'Header title / subtitle', 'selector': '.deadhead-header-copy', 'parent': 'header', 'container': True, 'order': 10},
     {'key': 'navPrevious', 'label': 'Previous button', 'selector': '.deadhead-prev', 'parent': 'navigation', 'order': 0},
     {'key': 'navPosition', 'label': 'Navigation position', 'selector': '.deadhead-nav-position', 'parent': 'navigation', 'order': 10},
     {'key': 'navNext', 'label': 'Next button', 'selector': '.deadhead-next', 'parent': 'navigation', 'order': 20},
     {'key': 'showTopline', 'label': 'Show counter / recordings', 'selector': '.deadhead-show-topline', 'parent': 'show', 'container': True, 'order': 0},
     {'key': 'showDate', 'label': 'Performance date', 'selector': '.deadhead-show-date', 'parent': 'show', 'order': 10},
     {'key': 'showVenue', 'label': 'Venue / location', 'selector': '.deadhead-show-venue', 'parent': 'show', 'order': 20},
     {'key': 'showLinks', 'label': 'Source links', 'selector': '.deadhead-show-actions', 'parent': 'show', 'container': True, 'order': 30},
     {'key': 'setlistHeading', 'label': 'Setlist heading / source', 'selector': '.deadhead-setlist-heading', 'parent': 'setlist', 'order': 0},
     {'key': 'setlistScroller', 'label': 'Setlist scrolling content', 'selector': '.deadhead-setlist-scroll', 'parent': 'setlist', 'container': True, 'order': 10},
     {'key': 'setlistBody', 'label': 'Sets and encore', 'selector': '.deadhead-setlist-body', 'parent': 'setlistScroller', 'container': True, 'order': 0},
     {'key': 'setlistFavorites', 'label': 'Favorite-song hits', 'selector': '.deadhead-favorites', 'parent': 'setlistScroller', 'order': 10},
     {'key': 'quoteText', 'label': 'Quote text', 'selector': '.deadhead-quote blockquote', 'parent': 'quote', 'order': 0},
     {'key': 'quoteAttribution', 'label': 'Quote attribution', 'selector': '.deadhead-quote figcaption', 'parent': 'quote', 'order': 10},
     {'key': 'listenButton', 'label': 'Listen suggestion button', 'selector': '.deadhead-another', 'parent': 'footer', 'order': 0},
     {'key': 'footerMeta', 'label': 'Footer status', 'selector': '.deadhead-footer-meta', 'parent': 'footer', 'container': True, 'order': 10},
 ],
 'settings': [{'key': 'era',
               'label': 'Favorite era',
               'type': 'select',
               'default': 'all',
               'options': [{'value': 'all', 'label': 'All years'},
                           {'value': '60s', 'label': '1960s'},
                           {'value': '70s', 'label': '1970s'},
                           {'value': '80s', 'label': '1980s'},
                           {'value': '90s', 'label': '1990s'}],
               'section': 'Shows & rotation',
               'sectionHelp': 'Choose which historical shows are considered and how the unattended show reel moves through them.',
               'sectionOpen': True},
              {'key': 'showMode',
               'label': 'Featured show priority',
               'type': 'select',
               'default': 'today',
               'options': [{'value': 'today', 'label': "Rotate today's history"},
                           {'value': 'favorites', 'label': 'Prefer favorite venues'},
                           {'value': 'surprise', 'label': 'Daily surprise order'}],
               'section': 'Shows & rotation'},
              {'key': 'showLimit',
               'label': 'Shows to keep in rotation',
               'type': 'select',
               'default': '12',
               'options': [{'value': '5', 'label': '5 shows'},
                           {'value': '8', 'label': '8 shows'},
                           {'value': '12', 'label': '12 shows'},
                           {'value': '20', 'label': '20 shows'},
                           {'value': '40', 'label': 'All available (up to 40)'}],
               'section': 'Shows & rotation'},
              {'key': 'showOrder',
               'label': 'Show order',
               'type': 'select',
               'default': 'oldest',
               'options': [{'value': 'oldest', 'label': 'Oldest first'},
                           {'value': 'newest', 'label': 'Newest first'},
                           {'value': 'shuffle', 'label': 'Daily shuffle'},
                           {'value': 'favorites', 'label': 'Favorite venues first'}],
               'section': 'Shows & rotation'},
              {'key': 'showBrowser',
               'label': 'Show browser style',
               'type': 'select',
               'default': 'year-strip',
               'options': [{'value': 'year-strip', 'label': 'Year strip'},
                           {'value': 'list', 'label': 'Compact show list'},
                           {'value': 'minimal', 'label': 'Featured show only'}],
               'section': 'Shows & rotation'},
              {'key': 'showBrowserEnabled',
               'label': 'Show show browser',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation'},
              {'key': 'browserMaxHeight',
               'label': 'Browser max height (px)',
               'type': 'number',
               'default': 118,
               'section': 'Shows & rotation',
               'min': 0,
               'max': 400,
               'step': 10,
               'help': 'Use 0 for no height limit.'},
              {'key': 'browserAutoScroll',
               'label': 'Auto-scroll show browser when it overflows',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation',
               'help': 'Keeps every venue/year visible on unattended displays. Scrolling only runs when the browser is actually clipped.'},
              {'key': 'browserScrollSpeed',
               'label': 'Browser auto-scroll speed (px/sec)',
               'type': 'number',
               'default': 18,
               'section': 'Shows & rotation',
               'min': 0.5,
               'max': 240,
               'step': 0.5,
               'help': 'Fine-grained reel speed. Lower values crawl slowly; higher values move quickly. Fractional speeds are supported.'},
              {'key': 'browserScrollStartDelay',
               'label': 'Browser pause before scrolling (sec)',
               'type': 'number',
               'default': 3,
               'section': 'Shows & rotation',
               'min': 0,
               'max': 120,
               'step': 0.5},
              {'key': 'browserScrollLoopPause',
               'label': 'Browser end / restart pause (sec)',
               'type': 'number',
               'default': 4,
               'section': 'Shows & rotation',
               'min': 0,
               'max': 180,
               'step': 0.5,
               'help': 'Used by Bounce and Restart. Continuous carousel mode repeats seamlessly without an end pause.'},
              {'key': 'browserScrollLoopMode',
               'label': 'Browser auto-scroll loop style',
               'type': 'select',
               'default': 'continuous',
               'options': [{'value': 'continuous', 'label': 'Continuous carousel · seamless repeat'},
                           {'value': 'bounce', 'label': 'Bounce · down/up continuously'},
                           {'value': 'restart', 'label': 'Restart · top to bottom, then top'},
                           {'value': 'once', 'label': 'Once · stop at the end'}],
               'section': 'Shows & rotation'},
              {'key': 'browserScrollPauseOnHover',
               'label': 'Pause browser auto-scroll while hovering',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation'},
              {'key': 'browserShowScrollbar',
               'label': 'Show browser scrollbar',
               'type': 'checkbox',
               'default': False,
               'section': 'Shows & rotation'},
              {'key': 'browserShowVenue',
               'label': 'Show venue in compact browser',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation'},
              {'key': 'browserShowLocation',
               'label': 'Show location in compact browser',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation'},
              {'key': 'autoRotate',
               'label': 'Automatically rotate shows',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation'},
              {'key': 'rotationSeconds',
               'label': 'Show rotation interval',
               'type': 'select',
               'default': '30',
               'options': [{'value': '15', 'label': '15 seconds'},
                           {'value': '30', 'label': '30 seconds'},
                           {'value': '60', 'label': '1 minute'},
                           {'value': '120', 'label': '2 minutes'}],
               'section': 'Shows & rotation'},
              {'key': 'pauseOnHover',
               'label': 'Pause rotations while hovering',
               'type': 'checkbox',
               'default': True,
               'section': 'Shows & rotation',
               'help': 'Applies to both show and quote rotation.'},
              {'key': 'favoriteVenues',
               'label': 'Favorite venues',
               'type': 'textarea',
               'default': '',
               'section': 'Shows & rotation',
               'help': 'Optional comma-separated venue or city names. Favorite ordering promotes matching shows.'},
              {'key': 'favoriteSongs',
               'label': 'Favorite songs',
               'type': 'textarea',
               'default': '',
               'section': 'Shows & rotation',
               'help': 'Optional comma-separated titles. Matching songs are highlighted when a setlist is available.'},
              {'key': 'showHeader',
               'label': 'Show header',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details',
               'sectionHelp': 'Turn individual lines on or off and replace the visible labels without changing the data source.'},
              {'key': 'showHeaderIcon',
               'label': 'Show header icon',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'headerIcon',
               'label': 'Header icon',
               'type': 'text',
               'default': '✺',
               'section': 'Header & show details',
               'help': 'One short symbol or emoji.',
               'placeholder': '✺'},
              {'key': 'headerTitle',
               'label': 'Header title',
               'type': 'text',
               'default': 'Today in Dead History',
               'section': 'Header & show details',
               'placeholder': 'Today in Dead History'},
              {'key': 'showHeaderSubtitle',
               'label': 'Show header subtitle',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showHeaderDate',
               'label': 'Show date in automatic subtitle',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showHeaderShowCount',
               'label': 'Show rotation count in automatic subtitle',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'headerSubtitle',
               'label': 'Custom header subtitle',
               'type': 'text',
               'default': '',
               'section': 'Header & show details',
               'help': 'Leave blank for the automatic date / show-count subtitle.'},
              {'key': 'showUnofficialLabel',
               'label': 'Show “unofficial fan integration” label',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showShowDetails',
               'label': 'Show featured show details',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details',
               'help': 'Master toggle for the featured performance date, venue/location, counters, and source links.'},
              {'key': 'showShowCounter',
               'label': 'Show “Show X of Y”',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showRecordingCount',
               'label': 'Show recording count',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showDate',
               'label': 'Show performance date',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'dateStyle',
               'label': 'Performance date format',
               'type': 'select',
               'default': 'iso',
               'options': [{'value': 'iso', 'label': 'YYYY-MM-DD'},
                           {'value': 'long', 'label': 'Month D, YYYY'},
                           {'value': 'year', 'label': 'Year only'}],
               'section': 'Header & show details'},
              {'key': 'showVenue', 'label': 'Show venue', 'type': 'checkbox', 'default': True, 'section': 'Header & show details'},
              {'key': 'showLocation',
               'label': 'Show city / location',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showNavigation',
               'label': 'Show Previous / Next controls',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'navigationStyle',
               'label': 'Navigation style',
               'type': 'select',
               'default': 'pills',
               'options': [{'value': 'pills', 'label': 'Round buttons'}, {'value': 'minimal', 'label': 'Minimal arrows'}],
               'section': 'Header & show details'},
              {'key': 'showPosition',
               'label': 'Show navigation position',
               'type': 'checkbox',
               'default': True,
               'section': 'Header & show details'},
              {'key': 'showSourceLinks',
               'label': 'Show source / listening links',
               'type': 'checkbox',
               'default': True,
               'section': 'Sources & listening',
               'sectionHelp': 'Choose each outbound link independently. Internet Archive is the default first listening destination, while setlist enrichment separately prefers JerryBase then Relisten then Archive.'},
              {'key': 'showJerryBaseLink',
               'label': 'Show JerryBase link',
               'type': 'checkbox',
               'default': True,
               'section': 'Sources & listening'},
              {'key': 'jerrybaseLabel',
               'label': 'JerryBase link label',
               'type': 'text',
               'default': 'JerryBase',
               'section': 'Sources & listening'},
              {'key': 'showArchiveLink',
               'label': 'Show Internet Archive link',
               'type': 'checkbox',
               'default': True,
               'section': 'Sources & listening'},
              {'key': 'archiveLabel',
               'label': 'Internet Archive link label',
               'type': 'text',
               'default': 'Internet Archive',
               'section': 'Sources & listening'},
              {'key': 'showRelistenLink',
               'label': 'Show Relisten link',
               'type': 'checkbox',
               'default': True,
               'section': 'Sources & listening'},
              {'key': 'relistenLabel',
               'label': 'Relisten link label',
               'type': 'text',
               'default': 'Listen on Relisten',
               'section': 'Sources & listening'},
              {'key': 'sourceLinkOrder',
               'label': 'Listening/source link order',
               'type': 'select',
               'default': 'archive,relisten,jerrybase',
               'options': [{'value': 'archive,relisten,jerrybase', 'label': 'Internet Archive → Relisten → JerryBase'},
                           {'value': 'archive,jerrybase,relisten', 'label': 'Internet Archive → JerryBase → Relisten'},
                           {'value': 'relisten,archive,jerrybase', 'label': 'Relisten → Internet Archive → JerryBase'},
                           {'value': 'relisten,jerrybase,archive', 'label': 'Relisten → JerryBase → Internet Archive'},
                           {'value': 'jerrybase,relisten,archive', 'label': 'JerryBase → Relisten → Internet Archive'},
                           {'value': 'jerrybase,archive,relisten', 'label': 'JerryBase → Internet Archive → Relisten'}],
               'section': 'Sources & listening',
               'help': 'Controls visible outbound-link order only. Setlist provider priority is configured separately.'},
              {'key': 'linkStyle',
               'label': 'Source link style',
               'type': 'select',
               'default': 'pills',
               'options': [{'value': 'pills', 'label': 'Pills'}, {'value': 'text', 'label': 'Plain text links'}],
               'section': 'Sources & listening'},
              {'key': 'showWeatherPick',
               'label': 'Show weather listening pick',
               'type': 'checkbox',
               'default': True,
               'section': 'Sources & listening'},
              {'key': 'weatherLabel',
               'label': 'Weather pick label',
               'type': 'text',
               'default': 'Weather pick',
               'section': 'Sources & listening'},
              {'key': 'weatherClearSong',
               'label': 'Clear-weather song',
               'type': 'text',
               'default': 'Here Comes Sunshine',
               'section': 'Sources & listening'},
              {'key': 'weatherRainSong',
               'label': 'Rain song',
               'type': 'text',
               'default': 'Looks Like Rain',
               'section': 'Sources & listening'},
              {'key': 'weatherSnowSong',
               'label': 'Snow song',
               'type': 'text',
               'default': 'Cold Rain and Snow',
               'section': 'Sources & listening'},
              {'key': 'weatherStormSong', 'label': 'Storm song', 'type': 'text', 'default': 'The Wheel', 'section': 'Sources & listening'},
              {'key': 'weatherFogSong', 'label': 'Fog song', 'type': 'text', 'default': 'Box of Rain', 'section': 'Sources & listening'},
              {'key': 'weatherFallbackSong',
               'label': 'Fallback song',
               'type': 'text',
               'default': 'Eyes of the World',
               'section': 'Sources & listening'},
              {'key': 'setlistsEnabled',
               'label': 'Show setlists',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists',
               'sectionHelp': 'Control enrichment, setlist metadata, visible height, and the unattended auto-scroll reel for long multi-set shows and encores.'},
              {'key': 'setlistSource',
               'label': 'Setlist source',
               'type': 'select',
               'default': 'auto',
               'options': [{'value': 'auto', 'label': 'Automatic · JerryBase → Relisten → Internet Archive → setlist.fm'},
                           {'value': 'jerrybase', 'label': 'JerryBase · first choice · no key'},
                           {'value': 'relisten', 'label': 'Relisten · second choice · no key'},
                           {'value': 'archive', 'label': 'Internet Archive · third choice · no key'},
                           {'value': 'setlistfm', 'label': 'setlist.fm · API key · optional last fallback'}],
               'section': 'Setlists'},
              {'key': 'setlistPreload',
               'label': 'Preload setlists for',
               'type': 'select',
               'default': '3',
               'options': [{'value': '1', 'label': 'Featured show only'},
                           {'value': '3', 'label': '3 shows'},
                           {'value': '5', 'label': '5 shows'},
                           {'value': '8', 'label': '8 shows'}],
               'section': 'Setlists'},
              {'key': 'setlistSmartLoad',
               'label': 'Smart-load missing setlists',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists',
               'help': 'When a rotating or selected show was not preloaded, LibreDisplay checks JerryBase, Relisten, then Internet Archive automatically instead of leaving the setlist area blank.'},
              {'key': 'setlistPreloadAhead',
               'label': 'Smart-load shows ahead',
               'type': 'number',
               'default': 2,
               'section': 'Setlists',
               'min': 0,
               'max': 6,
               'step': 1,
               'help': 'Prepares upcoming setlists in the background so unattended show rotation is less likely to wait for a lookup.'},
              {'key': 'setlistHeading', 'label': 'Setlist heading', 'type': 'text', 'default': 'Setlist', 'section': 'Setlists'},
              {'key': 'setlistShowSource',
               'label': 'Show setlist source / attribution',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists'},
              {'key': 'setlistShowMissing',
               'label': 'Show message when setlist is not loaded',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists'},
              {'key': 'setlistShowFavoriteHits',
               'label': 'Show favorite-song matches',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists'},
              {'key': 'setlistHighlightFavorites',
               'label': 'Highlight favorite songs inside setlists',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists'},
              {'key': 'setlistMaxSets',
               'label': 'Maximum sets / encores shown',
               'type': 'number',
               'default': 5,
               'section': 'Setlists',
               'min': 1,
               'max': 8,
               'step': 1,
               'help': 'Raise this for unusually long shows with extra sets or multiple encores.'},
              {'key': 'setlistSongsPerSet',
               'label': 'Maximum songs per set',
               'type': 'number',
               'default': 35,
               'section': 'Setlists',
               'min': 3,
               'max': 35,
               'step': 1},
              {'key': 'setlistMaxHeight',
               'label': 'Setlist max height (px)',
               'type': 'number',
               'default': 100,
               'section': 'Setlists',
               'min': 0,
               'max': 600,
               'step': 10,
               'help': 'Use 0 for no height limit.'},
              {'key': 'setlistAutoScroll',
               'label': 'Auto-scroll setlists when they overflow',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists',
               'help': 'Automatically reels through long multi-set shows and encores on unattended displays. It stays still when everything fits.'},
              {'key': 'setlistScrollSpeed',
               'label': 'Setlist auto-scroll speed (px/sec)',
               'type': 'number',
               'default': 14,
               'section': 'Setlists',
               'min': 0.5,
               'max': 240,
               'step': 0.5,
               'help': 'Fine-grained setlist reel speed. Fractional speeds are supported so very slow wall-display crawls work reliably.'},
              {'key': 'setlistScrollStartDelay',
               'label': 'Setlist pause before scrolling (sec)',
               'type': 'number',
               'default': 4,
               'section': 'Setlists',
               'min': 0,
               'max': 120,
               'step': 0.5},
              {'key': 'setlistScrollLoopPause',
               'label': 'Setlist pause at end / between loops (sec)',
               'type': 'number',
               'default': 5,
               'section': 'Setlists',
               'min': 0,
               'max': 180,
               'step': 0.5,
               'help': 'Used by Bounce and Restart. Continuous carousel mode repeats seamlessly without an end pause.'},
              {'key': 'setlistScrollLoopMode',
               'label': 'Setlist auto-scroll loop style',
               'type': 'select',
               'default': 'continuous',
               'options': [{'value': 'continuous', 'label': 'Continuous carousel · seamless repeat'},
                           {'value': 'restart', 'label': 'Restart · top to bottom, then top'},
                           {'value': 'bounce', 'label': 'Bounce · down/up continuously'},
                           {'value': 'once', 'label': 'Once · stop at the end'}],
               'section': 'Setlists'},
              {'key': 'setlistScrollPauseOnHover',
               'label': 'Pause setlist auto-scroll while hovering',
               'type': 'checkbox',
               'default': True,
               'section': 'Setlists'},
              {'key': 'setlistShowScrollbar',
               'label': 'Show setlist scrollbar',
               'type': 'checkbox',
               'default': False,
               'section': 'Setlists'},
              {'key': 'setlistApiKey',
               'label': 'setlist.fm API key',
               'type': 'password',
               'default': '',
               'section': 'Setlists',
               'required': False,
               'help': 'Optional. Automatic setlists try JerryBase first, Relisten second, Internet Archive third, and setlist.fm only as a final fallback when a key is present.'},
              {'key': 'quotesEnabled',
               'label': 'Show quotes & lyric snippets',
               'type': 'checkbox',
               'default': True,
               'section': 'Quotes',
               'sectionHelp': 'Rotate a much larger mix of sourced band-member quotes, short fan-favorite lyric hooks, and song spotlights. Choose the content mix, ordering, member filter, timing, and attribution independently.'},
              {'key': 'quoteContent',
               'label': 'Quote reel content',
               'type': 'select',
               'default': 'mixed',
               'options': [{'value': 'mixed', 'label': 'Quotes + lyric hooks + song spotlights'},
                           {'value': 'quotes', 'label': 'Member quotes only'},
                           {'value': 'lyrics', 'label': 'Lyric snippets only'},
                           {'value': 'spotlights', 'label': 'Fan-favorite song spotlights'}],
               'section': 'Quotes'},
              {'key': 'quoteOrder',
               'label': 'Quote reel order',
               'type': 'select',
               'default': 'daily-shuffle',
               'options': [{'value': 'daily-shuffle', 'label': 'Daily shuffle · recommended'},
                           {'value': 'catalog', 'label': 'Catalog order'}],
               'section': 'Quotes',
               'help': 'Daily shuffle uses a stable daily order, while the display starts at a time-based position so refreshes do not keep returning to the same first quote.'},
              {'key': 'quoteMember',
               'label': 'Member quote filter',
               'type': 'select',
               'default': 'all',
               'options': [{'value': 'all', 'label': 'Rotate all members'},
                           {'value': 'jerry', 'label': 'Jerry Garcia'},
                           {'value': 'bob', 'label': 'Bob Weir'},
                           {'value': 'phil', 'label': 'Phil Lesh'},
                           {'value': 'mickey', 'label': 'Mickey Hart'},
                           {'value': 'bill', 'label': 'Bill Kreutzmann'},
                           {'value': 'pigpen', 'label': 'Ron “Pigpen” McKernan'},
                           {'value': 'tom', 'label': 'Tom Constanten'},
                           {'value': 'keith', 'label': 'Keith Godchaux'},
                           {'value': 'donna', 'label': 'Donna Jean Godchaux'},
                           {'value': 'brent', 'label': 'Brent Mydland'},
                           {'value': 'vince', 'label': 'Vince Welnick'}],
               'section': 'Quotes'},
              {'key': 'quoteRotate', 'label': 'Rotate quotes / lyric snippets', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
              {'key': 'quoteSeconds',
               'label': 'Quote rotation interval',
               'type': 'select',
               'default': '60',
               'options': [{'value': '30', 'label': '30 seconds'},
                           {'value': '60', 'label': '1 minute'},
                           {'value': '120', 'label': '2 minutes'},
                           {'value': '300', 'label': '5 minutes'}],
               'section': 'Quotes'},
              {'key': 'quoteStyle',
               'label': 'Quote style',
               'type': 'select',
               'default': 'card',
               'options': [{'value': 'card', 'label': 'Indented quote card'},
                           {'value': 'plain', 'label': 'Plain quote'},
                           {'value': 'compact', 'label': 'Compact one-line attribution'}],
               'section': 'Quotes'},
              {'key': 'quoteShowMarks', 'label': 'Show quotation marks', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
              {'key': 'quoteShowMember', 'label': 'Show member name', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
              {'key': 'quoteShowSource', 'label': 'Show quote source link', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
              {'key': 'customQuotes',
               'label': 'Personal quote pack',
               'type': 'textarea',
               'default': '',
               'section': 'Quotes',
               'help': 'Optional lines: Member | Quote | Source URL. Keep quotes short and provide a source.'},
              {'key': 'showFooter',
               'label': 'Show footer',
               'type': 'checkbox',
               'default': True,
               'section': 'Footer & section order',
               'sectionHelp': 'Hide footer metadata, change the listen button, and arrange the content sections in your preferred order.'},
              {'key': 'showListenButton',
               'label': 'Show “what should I listen to?” button',
               'type': 'checkbox',
               'default': True,
               'section': 'Footer & section order'},
              {'key': 'listenButtonLabel',
               'label': 'Listen button label',
               'type': 'text',
               'default': 'What should I listen to?',
               'section': 'Footer & section order'},
              {'key': 'listenButtonBehavior',
               'label': 'Listen button behavior',
               'type': 'select',
               'default': 'surprise',
               'options': [{'value': 'surprise', 'label': 'Jump to another show'},
                           {'value': 'next', 'label': 'Go to next show'},
                           {'value': 'oldest', 'label': 'Jump to oldest show'},
                           {'value': 'newest', 'label': 'Jump to newest show'}],
               'section': 'Footer & section order'},
              {'key': 'showRotationStatus',
               'label': 'Show auto/manual status',
               'type': 'checkbox',
               'default': True,
               'section': 'Footer & section order'},
              {'key': 'showSetlistStatus',
               'label': 'Show loaded-setlist count',
               'type': 'checkbox',
               'default': True,
               'section': 'Footer & section order'},
              {'key': 'sectionOrder',
               'label': 'Content section order',
               'type': 'textarea',
               'default': 'browser, navigation, show, weather, setlist, quote, footer',
               'section': 'Footer & section order',
               'help': 'Comma-separated: browser, navigation, show, weather, setlist, quote, footer. Missing names are appended so content '
                       'is never lost accidentally.'},
              {'key': 'density',
               'label': 'Content density',
               'type': 'select',
               'default': 'cozy',
               'options': [{'value': 'compact', 'label': 'Compact'},
                           {'value': 'cozy', 'label': 'Cozy'},
                           {'value': 'roomy', 'label': 'Roomy'}],
               'section': 'Layout & spacing',
               'sectionHelp': 'Tune the card itself without changing the dashboard block size or the universal block controls.'},
              {'key': 'textAlign',
               'label': 'Text alignment',
               'type': 'select',
               'default': 'left',
               'options': [{'value': 'left', 'label': 'Left'}, {'value': 'center', 'label': 'Center'}],
               'section': 'Layout & spacing'},
              {'key': 'panelSurface',
               'label': 'Panel surface',
               'type': 'select',
               'default': 'gradient',
               'options': [{'value': 'gradient', 'label': 'Deadhead gradient'},
                           {'value': 'solid', 'label': 'Solid color'},
                           {'value': 'transparent', 'label': 'Transparent'}],
               'section': 'Layout & spacing'},
              {'key': 'panelRadius',
               'label': 'Panel corner radius (px)',
               'type': 'number',
               'default': 18,
               'section': 'Layout & spacing',
               'min': 0,
               'max': 48,
               'step': 1},
              {'key': 'panelPadding',
               'label': 'Panel padding (px)',
               'type': 'number',
               'default': 16,
               'section': 'Layout & spacing',
               'min': 6,
               'max': 48,
               'step': 1},
              {'key': 'sectionGap',
               'label': 'Section spacing (px)',
               'type': 'number',
               'default': 9,
               'section': 'Layout & spacing',
               'min': 0,
               'max': 32,
               'step': 1},
              {'key': 'titleScale',
               'label': 'Headline size (%)',
               'type': 'number',
               'default': 100,
               'section': 'Layout & spacing',
               'min': 70,
               'max': 180,
               'step': 5},
              {'key': 'bodyScale',
               'label': 'Body text size (%)',
               'type': 'number',
               'default': 100,
               'section': 'Layout & spacing',
               'min': 70,
               'max': 160,
               'step': 5},
              {'key': 'showDecorations',
               'label': 'Show decorative orbit rings',
               'type': 'checkbox',
               'default': True,
               'section': 'Layout & spacing'},
              {'key': 'visualMode',
               'label': 'Dashboard Deadhead effect',
               'type': 'select',
               'default': 'subtle',
               'options': [{'value': 'off', 'label': 'Block only'},
                           {'value': 'subtle', 'label': 'Subtle psychedelic accents'},
                           {'value': 'psychedelic', 'label': 'Full Deadhead color wash'}],
               'section': 'Colors & effects',
               'sectionHelp': 'Make the integration match your own dashboard palette. Colors are scoped to this block.'},
              {'key': 'accentColor', 'label': 'Primary accent color', 'type': 'color', 'default': '#e5c782', 'section': 'Colors & effects'},
              {'key': 'accentColor2',
               'label': 'Secondary accent color',
               'type': 'color',
               'default': '#8ed9ca',
               'section': 'Colors & effects'},
              {'key': 'panelColor', 'label': 'Solid panel color', 'type': 'color', 'default': '#171526', 'section': 'Colors & effects'},
              {'key': 'textColor', 'label': 'Main text color', 'type': 'color', 'default': '#f8f2e7', 'section': 'Colors & effects'},
              {'key': 'mutedColor', 'label': 'Muted text color', 'type': 'color', 'default': '#bdb7c5', 'section': 'Colors & effects'},
              {'key': 'accentStrength',
               'label': 'Accent strength (%)',
               'type': 'number',
               'default': 100,
               'section': 'Colors & effects',
               'min': 0,
               'max': 100,
               'step': 5},
              {'key': 'backgroundStrength',
               'label': 'Dashboard effect strength (%)',
               'type': 'number',
               'default': 100,
               'section': 'Colors & effects',
               'min': 0,
               'max': 100,
               'step': 5}]}

# Quotes are intentionally short sourced excerpts. Lyric snippets stay short and link to Dead.net song pages.
QUOTES=[
    {"key":"jerry","kind":"quote","member":"Jerry Garcia","quote":"All it takes to create another reality is for people to live in it.","source":"Grateful Dead Deadcast · Europe '72: Denmark","url":"https://www.dead.net/deadcast/europe-72-denmark"},
    {"key":"bob","kind":"quote","member":"Bob Weir","quote":"We've always been pretty free to do the things we want.","source":"November 1972 interview","url":"https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html"},
    {"key":"phil","kind":"quote","member":"Phil Lesh","quote":"Somehow the music would make us act in unison.","source":"Spring 1971 interview","url":"https://deadsources.blogspot.com/2013/12/spring-1971-phil-lesh-interview.html"},
    {"key":"mickey","kind":"quote","member":"Mickey Hart","quote":"I like to create things from nothing, to make things happen.","source":"PBS NewsHour · CANVAS","url":"https://www.pbs.org/newshour/show/grateful-dead-drummer-mickey-hart-combines-music-and-art-at-the-las-vegas-sphere"},
    {"key":"bill","kind":"quote","member":"Bill Kreutzmann","quote":"Even with the older material, you're always creating new music in the moment.","source":"Grateful Dead interview","url":"https://www.dead.net/features/dead-world-roundup/talkin-about-music-laughter-and-life-bill-kreutzmann"},
    {"key":"pigpen","kind":"quote","member":"Ron “Pigpen” McKernan","quote":"And then I’d sing and play harmonica. Way before the Warlocks.","source":"Deadcast archival interview · 10/6/70","url":"https://www.dead.net/adventures-pigpen-part-1"},
    {"key":"keith","kind":"quote","member":"Keith Godchaux","quote":"I don’t want to listen to it. I want to play it.","source":"Donna Jean recounting Keith · Grateful Dead Deadcast","url":"https://www.dead.net/enter-keith-godchaux"},
    {"key":"donna","kind":"quote","member":"Donna Jean Godchaux","quote":"When I sing again, it's going to be with that band.","source":"Grateful Dead Deadcast · Donna Jean","url":"https://www.dead.net/donna-jean"},
    {"key":"brent","kind":"quote","member":"Brent Mydland","quote":"There are people who like me and people who don’t like the fact that I’m in the band.","source":"The Golden Road interview, quoted by Phoenix New Times","url":"https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/"},
    {"key":"tom","kind":"quote","member":"Tom Constanten","quote":"We sort of threw the spaghetti at the wall to see what would happen.","source":"Grateful Web interview · 2026","url":"https://www.gratefulweb.com/articles/we-sort-of-threw-spaghetti-at-the-wall-an-interview-with-tom-constanten-of-the-grateful-dead/"},
    {"key":"vince","kind":"quote","member":"Vince Welnick","quote":"They’re very much a family, and that’s something you don’t find much in rock ’n’ roll anymore.","source":"Phoenix New Times interview · 1995","url":"https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/"},
    {"key":"lyrics","kind":"lyric","member":"Franklin's Tower","quote":"May the four winds blow you safely home","source":"Dead.net lyrics","url":"https://www.dead.net/song/franklins-tower"},
    {"key":"lyrics","kind":"lyric","member":"Terrapin Station","quote":"Some rise, some fall, some climb to get to Terrapin","source":"Dead.net lyrics","url":"https://www.dead.net/song/terrapin-station"},
    {"key":"lyrics","kind":"lyric","member":"Scarlet Begonias","quote":"The sky was yellow and the sun was blue","source":"Dead.net lyrics","url":"https://www.dead.net/song/scarlet-begonias"},
    {"key":"lyrics","kind":"lyric","member":"Ramble On Rose","quote":"The grass ain't greener on either side of the hill","source":"Fan-favorite line · Ramble On Rose","url":"https://www.dead.net/song/ramble-rose"},
    {"key":"lyrics","kind":"lyric","member":"Ripple","quote":"Let there be songs to fill the air","source":"Dead.net lyrics","url":"https://www.dead.net/song/ripple"},
    {"key":"lyrics","kind":"lyric","member":"Touch of Grey","quote":"I will get by, I will survive","source":"Dead.net lyrics","url":"https://www.dead.net/song/touch-grey"},
    {"key":"lyrics","kind":"lyric","member":"He's Gone","quote":"Nothing left to do but smile, smile, smile","source":"Dead.net lyrics","url":"https://www.dead.net/song/hes-gone"},
    {"key":"lyrics","kind":"lyric","member":"Truckin'","quote":"What a long strange trip it's been","source":"Dead.net lyrics","url":"https://www.dead.net/song/truckin"},
    {"key":"lyrics","kind":"lyric","member":"Help on the Way","quote":"Without love in the dream it'll never come true","source":"Dead.net lyrics","url":"https://www.dead.net/song/help-way"},
    {"key":"lyrics","kind":"lyric","member":"Box of Rain","quote":"A box of rain will ease the pain","source":"Dead.net lyrics","url":"https://www.dead.net/song/box-rain"},
    {"key":"lyrics","kind":"lyric","member":"Eyes of the World","quote":"Sometimes we live no particular way but our own","source":"Dead.net lyrics","url":"https://www.dead.net/song/eyes-world"},
    {"key":"lyrics","kind":"lyric","member":"The Music Never Stopped","quote":"The music never stopped","source":"Dead.net lyrics","url":"https://www.dead.net/song/music-never-stopped"},
    {"key":"lyrics","kind":"lyric","member":"Althea","quote":"There are things you can replace, and others you cannot","source":"Dead.net lyrics","url":"https://www.dead.net/song/althea"},
    {"key":"lyrics","kind":"lyric","member":"Cassidy","quote":"Let your life proceed by its own designs","source":"Dead.net lyrics","url":"https://www.dead.net/song/cassidy"},
    {"key":"lyrics","kind":"lyric","member":"Fire on the Mountain","quote":"Long distance runner, what you standing there for?","source":"Dead.net lyrics","url":"https://www.dead.net/song/fire-mountain"},
    {"key":"lyrics","kind":"lyric","member":"Uncle John's Band","quote":"What I want to know, how does the song go?","source":"Dead.net lyrics","url":"https://www.dead.net/song/uncle-johns-band"},
    {"key":"lyrics","kind":"lyric","member":"Estimated Prophet","quote":"California, a prophet on the burning shore","source":"Dead.net lyrics","url":"https://www.dead.net/song/estimated-prophet"},
    {"key":"lyrics","kind":"lyric","member":"Black Muddy River","quote":"I will walk alone by the black muddy river","source":"Dead.net lyrics","url":"https://www.dead.net/song/black-muddy-river"},
    {"key":"lyrics","kind":"lyric","member":"Standing on the Moon","quote":"I'd rather be with you","source":"Dead.net lyrics","url":"https://www.dead.net/song/standing-moon"},
    {"key":"lyrics","kind":"lyric","member":"Days Between","quote":"When all we ever wanted was to learn and grow","source":"Dead.net lyrics","url":"https://www.dead.net/song/days-between"},
    {"key":"lyrics","kind":"lyric","member":"Stella Blue","quote":"All the years combine, they melt into a dream","source":"Dead.net lyrics","url":"https://www.dead.net/song/stella-blue"},
    {"key":"lyrics","kind":"lyric","member":"The Wheel","quote":"Won't you try just a little bit harder","source":"Dead.net lyrics","url":"https://www.dead.net/song/wheel"},
    {"key":"lyrics","kind":"lyric","member":"Sugaree","quote":"Shake it, shake it, Sugaree","source":"Dead.net lyrics","url":"https://www.dead.net/song/sugaree"},
    {"key":"lyrics","kind":"lyric","member":"Bird Song","quote":"Dry your eyes on the wind","source":"Dead.net lyrics","url":"https://www.dead.net/song/bird-song"},
    {"key":"lyrics","kind":"lyric","member":"Attics of My Life","quote":"When I had no wings to fly, you flew","source":"Dead.net lyrics","url":"https://www.dead.net/song/attics-my-life"},
    {"key":"lyrics","kind":"lyric","member":"Not Fade Away","quote":"Our love is real, not fade away","source":"Dead.net lyrics","url":"https://www.dead.net/song/not-fade-away"}
]


# The built-in reel intentionally keeps direct lyric excerpts very short.  The larger
# rotation is achieved with many song spotlights plus sourced member quotes, so an
# unattended display can stay fresh without bundling long copyrighted lyric passages.
EXTRA_LYRIC_SNIPPETS=[
    {"key":"lyric-bertha","kind":"lyric","member":"Bertha","quote":"Why don't you arrest me?","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-deal","kind":"lyric","member":"Deal","quote":"Don't you let that deal go down","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-brown-eyed-women","kind":"lyric","member":"Brown-Eyed Women","quote":"The bottle was dusty but the liquor was clean","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-china-cat","kind":"lyric","member":"China Cat Sunflower","quote":"Like a one-eyed Cheshire, like a diamond-eye jack","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-st-stephen","kind":"lyric","member":"St. Stephen","quote":"Wherever he goes, the people all complain","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-casey-jones","kind":"lyric","member":"Casey Jones","quote":"Driving that train, high on cocaine","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-sugar-magnolia","kind":"lyric","member":"Sugar Magnolia","quote":"Sunshine daydream, walking in the tall trees","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-friend-devil","kind":"lyric","member":"Friend of the Devil","quote":"A friend of the devil is a friend of mine","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-dire-wolf","kind":"lyric","member":"Dire Wolf","quote":"Please don't murder me","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-us-blues","kind":"lyric","member":"U.S. Blues","quote":"Wave that flag, wave it wide and high","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-new-speedway","kind":"lyric","member":"New Speedway Boogie","quote":"One way or another, this darkness got to give","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-wharf-rat","kind":"lyric","member":"Wharf Rat","quote":"I'll get up and fly away","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-brokedown","kind":"lyric","member":"Brokedown Palace","quote":"Fare you well, fare you well","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-loser","kind":"lyric","member":"Loser","quote":"I can tell the Queen of Diamonds","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-jack-straw","kind":"lyric","member":"Jack Straw","quote":"We can share the women, we can share the wine","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-morning-dew","kind":"lyric","member":"Morning Dew","quote":"I guess it doesn't matter anyway","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-playing","kind":"lyric","member":"Playing in the Band","quote":"Some folks trust to reason","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-china-doll","kind":"lyric","member":"China Doll","quote":"Just a little nervous from the fall","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-row-jimmy","kind":"lyric","member":"Row Jimmy","quote":"Roll me over and turn me around","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-shakedown","kind":"lyric","member":"Shakedown Street","quote":"Don't tell me this town ain't got no heart","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-cosmic-charlie","kind":"lyric","member":"Cosmic Charlie","quote":"Go on home, your mama's calling you","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-candyman","kind":"lyric","member":"Candyman","quote":"Come on boys and gamble","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-doin-rag","kind":"lyric","member":"Doin' That Rag","quote":"Come on over, sweetly speaking","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-dupree","kind":"lyric","member":"Dupree's Diamond Blues","quote":"Baby, baby, it looks like rain","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-high-time","kind":"lyric","member":"High Time","quote":"You told me goodbye","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-black-peter","kind":"lyric","member":"Black Peter","quote":"See here how everything lead up to this day","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-cumberland","kind":"lyric","member":"Cumberland Blues","quote":"Make good money, five dollars a day","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-easy-wind","kind":"lyric","member":"Easy Wind","quote":"Gotta find a woman be good to me","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-operator","kind":"lyric","member":"Operator","quote":"Operator, can you help me?","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-passenger","kind":"lyric","member":"Passenger","quote":"Firefly, can you see me?","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-ship-fools","kind":"lyric","member":"Ship of Fools","quote":"Ship of fools on a cruel sea","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-throwing-stones","kind":"lyric","member":"Throwing Stones","quote":"Ashes, ashes, all fall down","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-west-la","kind":"lyric","member":"West L.A. Fadeaway","quote":"Here's what I say","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-bucket","kind":"lyric","member":"Hell in a Bucket","quote":"At least I'm enjoying the ride","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-foolish-heart","kind":"lyric","member":"Foolish Heart","quote":"Never give your love, my friend, unto a foolish heart","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-built-last","kind":"lyric","member":"Built to Last","quote":"Built to last till time itself falls tumbling","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-liberty","kind":"lyric","member":"Liberty","quote":"Ooh freedom, ooh liberty","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-so-many-roads","kind":"lyric","member":"So Many Roads","quote":"So many roads I know","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-lazy-river","kind":"lyric","member":"Lazy River Road","quote":"Way down upon Sycamore Slough","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-corrina","kind":"lyric","member":"Corrina","quote":"Corrina, wake it up baby","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-picasso","kind":"lyric","member":"Picasso Moon","quote":"Bigger than a drive-in movie","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-victim","kind":"lyric","member":"Victim or the Crime","quote":"Am I the victim or the crime?","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-wrs","kind":"lyric","member":"Weather Report Suite","quote":"Wake of the flood, laughing water","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-let-grow","kind":"lyric","member":"Let It Grow","quote":"Let it grow, greatly yield","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-stranger","kind":"lyric","member":"Feel Like a Stranger","quote":"You know it's gonna get stranger","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-lost-sailor","kind":"lyric","member":"Lost Sailor","quote":"Compass card is spinning","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-saint","kind":"lyric","member":"Saint of Circumstance","quote":"Sure don't know what I'm going for","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-alabama","kind":"lyric","member":"Alabama Getaway","quote":"Thirty-two teeth in a jawbone","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-far-from-me","kind":"lyric","member":"Far From Me","quote":"This is final, this is farewell","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-blow-away","kind":"lyric","member":"Blow Away","quote":"You got to blow away","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-little-light","kind":"lyric","member":"Just a Little Light","quote":"This could be just a little light","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-tons-steel","kind":"lyric","member":"Tons of Steel","quote":"She weighs more by the day","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-esau","kind":"lyric","member":"My Brother Esau","quote":"Shadowboxing the apocalypse","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-might-well","kind":"lyric","member":"Might as Well","quote":"Might as well, might as well","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-crazy-fingers","kind":"lyric","member":"Crazy Fingers","quote":"Gone are the days we stopped to decide","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-comes-time","kind":"lyric","member":"Comes a Time","quote":"Comes a time when the blind man takes your hand","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-eleven","kind":"lyric","member":"The Eleven","quote":"No more time to tell how","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-mountains","kind":"lyric","member":"Mountains of the Moon","quote":"Hi ho, the carrion crow","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-rosemary","kind":"lyric","member":"Rosemary","quote":"Boots were of leather, a breath of cologne","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-alligator","kind":"lyric","member":"Alligator","quote":"Sleepy alligator in the noonday sun","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-golden-road","kind":"lyric","member":"The Golden Road","quote":"See that girl barefootin' along","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
    {"key":"lyric-cream-puff","kind":"lyric","member":"Cream Puff War","quote":"Wait a minute, watch what you're doing","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
]

SONG_SPOTLIGHT_TITLES=[
    'Alabama Getaway','Alligator','Althea','And We Bid You Goodnight','Around and Around','Attics of My Life','Beat It on Down the Line','Bertha','Big Boss Man','Big River','Bird Song','Black Muddy River','Black Peter','Blow Away','Box of Rain','Brokedown Palace','Brown-Eyed Women','Built to Last','Candyman','Casey Jones','Cassidy','China Cat Sunflower','China Doll','Cold Rain and Snow','Comes a Time','Cosmic Charlie','Crazy Fingers','Cream Puff War','Cumberland Blues','Dancing in the Street','Dark Star','Days Between','Deal','Dire Wolf','Doin’ That Rag','Don’t Ease Me In','Dupree’s Diamond Blues','Easy Answers','Easy Wind','El Paso','Estimated Prophet','Eyes of the World','Far From Me','Feel Like a Stranger','Fire on the Mountain','Foolish Heart','Franklin’s Tower','Friend of the Devil','Goin’ Down the Road Feeling Bad','Good Lovin’','Good Morning Little School Girl','Hard to Handle','He’s Gone','Hell in a Bucket','Help on the Way','Here Comes Sunshine','High Time','I Know You Rider','I Need a Miracle','It Must Have Been the Roses','Jack Straw','Jack-A-Roe','Just a Little Light','Lazy Lightning','Lazy River Road','Let It Grow','Liberty','Looks Like Rain','Loose Lucy','Loser','Lost Sailor','Mama Tried','Me and My Uncle','Mexicali Blues','Might as Well','Mississippi Half-Step Uptown Toodeloo','Morning Dew','Mountains of the Moon','Mr. Charlie','Music Never Stopped','My Brother Esau','New Minglewood Blues','New Speedway Boogie','Not Fade Away','One More Saturday Night','Operator','Passenger','Peggy-O','Picasso Moon','Playing in the Band','Promised Land','Ramble On Rose','Ripple','Row Jimmy','Saint of Circumstance','Samson and Delilah','Scarlet Begonias','Shakedown Street','Ship of Fools','So Many Roads','St. Stephen','Standing on the Moon','Stella Blue','Sugar Magnolia','Sugaree','Supplication','Tennessee Jed','Terrapin Station','The Eleven','The Golden Road','The Other One','The Wheel','They Love Each Other','Throwing Stones','Tons of Steel','Touch of Grey','Truckin’','U.S. Blues','Unbroken Chain','Uncle John’s Band','Victim or the Crime','Viola Lee Blues','Wang Dang Doodle','Weather Report Suite','West L.A. Fadeaway','Wharf Rat','Women Are Smarter','You Win Again','Aiko Aiko','All Along the Watchtower','Baby Blue','Ballad of a Thin Man','Big Railroad Blues','Black-Throated Wind','Broken Arrow','Caution','China-Rider','Cold Jordan','Corrina','Cryptical Envelopment','Day Job','Dear Mr. Fantasy','Death Don’t Have No Mercy','Desolation Row','Drums','Easy to Love You','Eternity','Feedback','Good Times','Hey Pocky Way','I Fought the Law','Iko Iko','It’s All Over Now','It’s All Over Now, Baby Blue','Johnny B. Goode','Keep Your Day Job','Knockin’ on Heaven’s Door','Little Red Rooster','Looks Like Rain','Maggie’s Farm','Man Smart, Woman Smarter','Matilda','Mind Left Body Jam','Mission in the Rain','Money Money','Morning Dew','New Orleans','Nobody’s Fault but Mine','Queen Jane Approximately','Reuben and Cherise','Revolution','Road Runner','Sage & Spirit','Samba in the Rain','She Belongs to Me','Sittin’ on Top of the World','Smokestack Lightning','Space','Spoonful','The Last Time','The Race Is On','The Same Thing','U.S. Blues','Walkin’ Blues','Wave to the Wind','Werewolves of London','When I Paint My Masterpiece','You Ain’t Woman Enough','You See a Broken Heart','Keep on Growing','Let the Good Times Roll','Dear Prudence','Good Golly Miss Molly','Midnight Hour','Turn on Your Lovelight','Hurts Me Too','King Bee','Next Time You See Me','Minglewood Blues','C.C. Rider','Around and Around','Promised Land','Big River','El Paso','Me and Bobby McGee','Sing Me Back Home','Mama Tried','Dark Hollow','Deep Elem Blues','Rosalie McFall','Monkey and the Engineer','Ripple','To Lay Me Down','Cumberland Blues','Dire Wolf','Friend of the Devil','Cassidy','Bird Song','China Doll','Wharf Rat','Brokedown Palace','Box of Rain','Attics of My Life','Unbroken Chain','Pride of Cucamonga','Passenger','Sunrise','Estimated Prophet','Terrapin Station','Shakedown Street','France','From the Heart of Me','Lost Sailor','Saint of Circumstance','Alabama Getaway','Far From Me','Feel Like a Stranger','Touch of Grey','West L.A. Fadeaway','Hell in a Bucket','Throwing Stones','Black Muddy River','Foolish Heart','Built to Last','Standing on the Moon','Picasso Moon','Victim or the Crime','Liberty','Days Between','So Many Roads','Lazy River Road'
]

def _song_spotlights():
    seen=set();rows=[]
    for title in SONG_SPOTLIGHT_TITLES:
        normalized=str(title).strip()
        key=normalized.casefold()
        if not normalized or key in seen: continue
        seen.add(key)
        rows.append({"key":"spotlight-"+hashlib.sha1(normalized.encode()).hexdigest()[:10],"kind":"spotlight","member":"Fan favorite","quote":normalized,"source":"Song spotlight","url":"https://www.dead.net/songs"})
    return rows

MEMBER_ORDER=['jerry','bob','phil','mickey','bill','pigpen','tom','keith','donna','brent','vince']

def _tokens(value):
    return [x.strip().lower() for x in re.split(r'[,;\n]+',str(value or '')) if x.strip()][:40]

def _bool(value, default=False):
    if isinstance(value,bool): return value
    if value is None: return default
    return str(value).strip().lower() not in ('0','false','no','off','')

def _int(value, lo, hi, default):
    try: value=int(float(value))
    except Exception: value=default
    return max(lo,min(hi,value))

def _number(value, lo, hi, default, step=1):
    try: value=float(value)
    except Exception:
        try: value=float(default)
        except Exception: value=0.0
    value=max(float(lo),min(float(hi),value))
    try: step=float(step)
    except Exception: step=1.0
    if step>=1 and float(step).is_integer() and float(lo).is_integer() and float(hi).is_integer():
        return int(value)
    return round(value,4)

def _color(value, default):
    value=str(value or '').strip()
    return value.lower() if re.match(r'^#[0-9a-fA-F]{6}$',value) else default

def _display_settings(settings):
    hidden={'setlistApiKey','favoriteVenues','favoriteSongs','customQuotes'}
    output={}
    for field in MANIFEST.get('settings') or []:
        key=field.get('key')
        if not key or key in hidden: continue
        default=field.get('default');value=settings.get(key,default);kind=field.get('type')
        if kind=='checkbox': output[key]=_bool(value,_bool(default,False))
        elif kind=='number': output[key]=_number(value,field.get('min',-100000),field.get('max',100000),default or 0,field.get('step',1))
        elif kind=='select':
            allowed={str(x.get('value')) for x in field.get('options') or []};candidate=str(value if value is not None else default)
            output[key]=candidate if candidate in allowed else str(default or '')
        elif kind=='color': output[key]=_color(value,str(default or '#ffffff'))
        else: output[key]=plain_text(value,500 if kind=='textarea' else (8 if key=='headerIcon' else 240))
    return output

def _era_ok(year, era):
    if era=='all': return True
    try: decade=int(str(era)[:2])*10+1900
    except Exception: return True
    return decade<=int(year)<decade+10

def _show_date(value):
    text=str(value or '')[:64]
    match=re.search(r'(19\d{2})-(\d{2})-(\d{2})',text)
    return match.group(0) if match else ''

def _venue_from_doc(doc):
    venue=plain_text(doc.get('venue') or '',160)
    coverage=plain_text(doc.get('coverage') or '',120)
    title=plain_text(doc.get('title') or '',220)
    if not venue:
        match=re.search(r'Live at (.+?) on \d{4}-\d{2}-\d{2}',title,re.I)
        if match: venue=match.group(1).strip()
    return venue,coverage,title

def _archive_today(ctx, today):
    mmdd=today.strftime('%m-%d')
    query=f'collection:GratefulDead AND identifier:gd*-{mmdd}*'
    params=[('q',query),('fl[]','identifier'),('fl[]','title'),('fl[]','date'),('fl[]','venue'),('fl[]','coverage'),('rows','220'),('page','1'),('output','json')]
    url='https://archive.org/advancedsearch.php?'+urlencode(params)
    data,_,_=request_json(ctx,url,max_bytes=3*1024*1024)
    docs=(data.get('response') or {}).get('docs') or []
    shows={}
    for doc in docs:
        date=_show_date(doc.get('date') or doc.get('title') or doc.get('identifier'))
        if not date or date[5:]!=today.strftime('%m-%d'): continue
        year=int(date[:4]); identifier=plain_text(doc.get('identifier') or '',180)
        if not identifier: continue
        venue,coverage,title=_venue_from_doc(doc)
        row=shows.setdefault(date,{"date":date,"year":year,"venue":venue or 'Venue unavailable',"location":coverage,"title":title,"identifier":identifier,"archiveUrl":f'https://archive.org/details/{quote(identifier)}',"relistenUrl":f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',"jerrybaseUrl":f'https://jerrybase.com/events/{date.replace("-","")}-01',"recordings":0})
        row['recordings']+=1
        if row['venue']=='Venue unavailable' and venue: row['venue']=venue
        if not row['location'] and coverage: row['location']=coverage
    return sorted(shows.values(),key=lambda x:x['date'])

def _fallback_today(today):
    known={
        '05-08':[('1977-05-08','Barton Hall, Cornell University','Ithaca, NY')],
        '06-12':[('1980-06-12','Portland Memorial Coliseum','Portland, OR')],
        '09-30':[('1976-09-30','Auditorium, Ohio State University','Columbus, OH'),('1993-09-30','Boston Garden','Boston, MA')],
        '10-06':[('1970-10-06','Grateful Dead live performance','Today in Dead history')]
    }
    rows=[]
    for date,venue,location in known.get(today.strftime('%m-%d'),[]):
        rows.append({"date":date,"year":int(date[:4]),"venue":venue,"location":location,"title":"","identifier":"","archiveUrl":"https://archive.org/details/GratefulDead","relistenUrl":f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',"jerrybaseUrl":f'https://jerrybase.com/events/{date.replace("-","")}-01',"recordings":0,"fallback":True})
    return rows

def _custom_quotes(value):
    out=[]
    for line in str(value or '').splitlines()[:30]:
        parts=[x.strip() for x in line.split('|',2)]
        if len(parts)<2 or not parts[0] or not parts[1]: continue
        url=parts[2] if len(parts)>2 and re.match(r'^https?://',parts[2],re.I) else ''
        out.append({"key":"custom","kind":"quote","member":plain_text(parts[0],60),"quote":plain_text(parts[1],220),"source":"Personal quote pack","url":url})
    return out

def _quote_rows(settings,today):
    rows=QUOTES+EXTRA_LYRIC_SNIPPETS+_song_spotlights()+_custom_quotes(settings.get('customQuotes'))
    # Remove duplicate visible entries even when a song exists in more than one source family.
    deduped=[];seen=set()
    for row in rows:
        sig=(str(row.get('kind') or ''),str(row.get('member') or '').casefold(),str(row.get('quote') or '').casefold())
        if sig in seen: continue
        seen.add(sig);deduped.append(row)
    rows=deduped
    content=str(settings.get('quoteContent') or 'mixed').lower()
    if content=='quotes': rows=[x for x in rows if x.get('kind','quote')=='quote']
    elif content=='lyrics': rows=[x for x in rows if x.get('kind')=='lyric']
    elif content=='spotlights': rows=[x for x in rows if x.get('kind')=='spotlight']
    member=str(settings.get('quoteMember') or 'all').lower()
    if member!='all' and content not in ('lyrics','spotlights'):
        quotes=[x for x in rows if x.get('kind','quote')=='quote' and x.get('key')==member]
        companion=[x for x in rows if x.get('kind') in ('lyric','spotlight')] if content=='mixed' else []
        rows=quotes+companion or rows
    order=str(settings.get('quoteOrder') or 'daily-shuffle').lower()
    if order!='catalog' and rows:
        seed=today.isoformat()+member+content
        rows.sort(key=lambda x:hashlib.sha256((seed+'|'+str(x.get('kind'))+'|'+str(x.get('member'))+'|'+str(x.get('quote'))).encode()).hexdigest())
    return rows

def _favorite_score(show, favorites):
    hay=f"{show.get('venue','')} {show.get('location','')}".lower()
    return sum(1 for token in favorites if token in hay)

def _order_shows(shows,settings,today):
    rows=list(shows);order=str(settings.get('showOrder') or 'oldest').lower();favorites=_tokens(settings.get('favoriteVenues'))
    if order=='newest': rows.sort(key=lambda x:x.get('year',0),reverse=True)
    elif order=='favorites' and favorites: rows.sort(key=lambda x:(-_favorite_score(x,favorites),x.get('year',0)))
    elif order=='shuffle':
        seed=today.isoformat()+str(settings.get('era') or 'all')
        rows.sort(key=lambda x:hashlib.sha256((seed+x.get('date','')).encode()).hexdigest())
    else: rows.sort(key=lambda x:x.get('year',0))
    return rows

def _featured_index(shows,settings,today):
    if not shows:return -1
    mode=str(settings.get('showMode') or 'today');favorites=_tokens(settings.get('favoriteVenues'))
    if mode=='favorites' and favorites:
        scores=[_favorite_score(show,favorites) for show in shows]
        if max(scores)>0:return scores.index(max(scores))
    if mode=='surprise':
        seed=today.isoformat()+str(settings.get('era') or 'all')+'surprise'
        return int(hashlib.sha256(seed.encode()).hexdigest()[:10],16)%len(shows)
    return 0

def _request_text(ctx,url,max_bytes=900*1024):
    status,_,raw,final=ctx.request(url,headers={'User-Agent':'LibreDisplay integration'},max_bytes=max_bytes)
    if status!=200: raise RuntimeError(f'HTTP {status}')
    return raw.decode('utf-8','replace'),final

def _clean_html_text(value):
    text=re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>',' ',str(value or ''),flags=re.I|re.S)
    text=re.sub(r'<br\s*/?>|</(?:p|div|li|tr|h[1-6])>','\n',text,flags=re.I)
    text=re.sub(r'<[^>]+>',' ',text)
    text=html.unescape(text)
    return re.sub(r'[ \t]+',' ',text).replace('\r','')

def _jerrybase_setlist(ctx,show,favorites):
    date=str(show.get('date') or '')
    if not re.match(r'^19\d{2}-\d{2}-\d{2}$',date): return None
    url=f'https://jerrybase.com/events/{date.replace("-","")}-01'
    raw,final=_request_text(ctx,url,max_bytes=1200*1024)
    title_match=re.search(r'<h4[^>]*>\s*Grateful Dead.*?</h4>',raw,re.I|re.S)
    if not title_match and 'Grateful Dead' not in raw: return None
    venue='';vm=re.search(r'<h4[^>]*>\s*<a[^>]*>(.*?)</a>\s*,\s*<a[^>]*>(.*?)</a>\s*</h4>',raw,re.I|re.S)
    if vm: venue=' · '.join(plain_text(x,120) for x in vm.groups() if plain_text(x,120))
    start=re.search(r'<h2[^>]*>\s*Setlist\s*</h2>',raw,re.I|re.S)
    if not start:
        start=re.search(r'>\s*Setlist\s*<',raw,re.I|re.S)
    if not start:return None
    tail=raw[start.end():]
    end=re.search(r'Average\s+Song\s+Gap|Songs\s+By\s+Album|<h2[^>]*>\s*Recordings',tail,re.I|re.S)
    block=tail[:end.start()] if end else tail[:90000]
    block=re.sub(r'<h[1-6][^>]*>\s*(Set\s*\d+|Encore)\s*</h[1-6]>',lambda m:f'\n@@{plain_text(m.group(1),30)}@@\n',block,flags=re.I|re.S)
    block=re.sub(r'<(?:strong|b)[^>]*>\s*(Set\s*\d+|Encore)\s*</(?:strong|b)>',lambda m:f'\n@@{plain_text(m.group(1),30)}@@\n',block,flags=re.I|re.S)
    parts=re.split(r'@@(Set\s*\d+|Encore)@@',block,flags=re.I)
    sets=[]
    for i in range(1,len(parts),2):
        name=plain_text(parts[i],30);seg=parts[i+1] if i+1<len(parts) else ''
        anchors=[plain_text(x,120) for x in re.findall(r'<a\b[^>]*>(.*?)</a>',seg,re.I|re.S)]
        songs=[]
        for song in anchors:
            song=re.sub(r'\s*\[\d+\]\s*','',song).strip()
            if not song or song.lower() in {'archive.org','reviews','show in calendar'}: continue
            if song not in songs:songs.append(song)
        if not songs:
            text=_clean_html_text(seg)
            songs=[plain_text(x,100) for x in re.split(r'\s*,\s*|\s+>\s+',text) if plain_text(x,100)][:35]
        if songs:sets.append({'name':name.title() if name.lower()!='encore' else 'Encore','songs':songs[:35]})
    if not sets:return None
    flat=[song for group in sets for song in group['songs']]
    hits=[song for song in flat if any(token in song.lower() for token in favorites)][:10]
    return {'sets':sets[:8],'favoriteSongHits':hits,'url':final or url,'attribution':'JerryBase','sourceKind':'no-key','venue':venue}

def _relisten_setlist(ctx,show,favorites):
    url=str(show.get('relistenUrl') or '').strip()
    if not url:return None
    raw,final=_request_text(ctx,url,max_bytes=1800*1024)
    # Relisten's current show page exposes track links in performance order. Keep this parser
    # intentionally tolerant so a markup refresh simply falls through to Archive instead of failing the block.
    songs=[]
    for href,label in re.findall(r'<a\b[^>]*href=[\"\']([^\"\']+)[\"\'][^>]*>(.*?)</a>',raw,re.I|re.S):
        href=html.unescape(href)
        if '/grateful-dead/' not in href or not re.search(r'/\d{4}/\d{2}/\d{2}/[^/?#]+',href): continue
        title=plain_text(_clean_html_text(label),120)
        title=re.sub(r'\s+\d{1,2}:\d{2}(?::\d{2})?\s*$','',title).strip()
        title=re.sub(r'\s*[-–>]\s*$','',title).strip()
        if not title or title.lower() in {'fin','sources','view on archive.org','tuning','crowd','intro'}: continue
        if title not in songs:songs.append(title)
    if not songs:
        # Next/React payload fallback: collect track-shaped title/name objects without depending on a private endpoint.
        for blob in re.findall(r'<script\b[^>]*>(.*?)</script>',raw,re.I|re.S):
            if 'track' not in blob.lower(): continue
            for title in re.findall(r'[\"\'](?:title|name)[\"\']\s*:\s*[\"\']([^\"\']{2,120})[\"\']',html.unescape(blob),re.I):
                title=plain_text(title,120)
                if title and title.lower() not in {'tuning','crowd','intro'} and title not in songs:songs.append(title)
    songs=songs[:45]
    if not songs:return None
    hits=[song for song in songs if any(token in song.lower() for token in favorites)][:10]
    return {'sets':[{'name':'Relisten','songs':songs}],'favoriteSongHits':hits,'url':final or url,'attribution':'Relisten','sourceKind':'no-key'}

def _archive_track_setlist(ctx,show,favorites):
    identifier=str(show.get('identifier') or '').strip()
    if not identifier:return None
    data,_,_=request_json(ctx,f'https://archive.org/metadata/{quote(identifier)}',max_bytes=2*1024*1024)
    files=data.get('files') or [];rows=[]
    for f in files:
        title=plain_text(f.get('title') or '',120)
        track=plain_text(f.get('track') or '',20)
        if not title or title.lower() in {'tuning','crowd','intro'}: continue
        if not track and str(f.get('name') or '').lower().endswith(('.txt','.jpg','.png','.xml')): continue
        try: order=float(re.sub(r'[^0-9.]','',track) or 9999)
        except Exception: order=9999
        if title not in [x[1] for x in rows]:rows.append((order,title))
    rows.sort(key=lambda x:x[0]);songs=[x[1] for x in rows[:45]]
    if not songs:return None
    hits=[song for song in songs if any(token in song.lower() for token in favorites)][:10]
    return {'sets':[{'name':'Recording','songs':songs}],'favoriteSongHits':hits,'url':show.get('archiveUrl'),'attribution':'Internet Archive metadata','sourceKind':'no-key'}

def _setlistfm_enrichment(ctx,key,show,favorites):
    if not key or not show:return None
    date=datetime.date.fromisoformat(show['date']).strftime('%d-%m-%Y')
    url='https://api.setlist.fm/rest/1.0/search/setlists?'+urlencode({'artistName':'Grateful Dead','date':date,'p':1})
    data,_,_=request_json(ctx,url,headers={'Accept':'application/json','x-api-key':str(key).strip(),'User-Agent':'LibreDisplay integration'})
    rows=data.get('setlist') or []
    if not rows:return None
    row=rows[0];sets=[];flat=[]
    for group in (row.get('sets') or {}).get('set') or []:
        songs=[plain_text(x.get('name'),100) for x in group.get('song') or [] if plain_text(x.get('name'),100)]
        if songs: sets.append({'name':plain_text(group.get('name') or ('Encore' if group.get('encore') else 'Set'),40),'songs':songs[:35]});flat.extend(songs)
    hits=[song for song in flat if any(t in song.lower() for t in favorites)][:10]
    return {'sets':sets[:8],'favoriteSongHits':hits,'url':plain_text(row.get('url'),300),'attribution':'setlist.fm','sourceKind':'api-key'}

# Backwards-compatible helper name retained for companion/runtime contracts.
def _setlist_enrichment(ctx,key,show,favorites):
    return _setlistfm_enrichment(ctx,key,show,favorites)

_SETLIST_CACHE={}
_SETLIST_CACHE_TTL=6*60*60
_SETLIST_NEGATIVE_TTL=30*60

def _setlist_cache_key(settings,show):
    source=str(settings.get('setlistSource') or 'auto').lower()
    keyed='1' if str(settings.get('setlistApiKey') or '').strip() else '0'
    return (str(show.get('date') or ''),str(show.get('identifier') or ''),source,keyed)

def _setlist_with_favorites(row,favorites):
    if not row:return None
    copy=json.loads(json.dumps(row))
    flat=[song for group in copy.get('sets') or [] for song in group.get('songs') or []]
    copy['favoriteSongHits']=[song for song in flat if any(token in str(song).lower() for token in favorites)][:10]
    return copy

def _setlist_cache_get(settings,show,favorites):
    item=_SETLIST_CACHE.get(_setlist_cache_key(settings,show))
    if not item:return False,None
    saved_at,row=item
    ttl=_SETLIST_CACHE_TTL if row else _SETLIST_NEGATIVE_TTL
    if time.time()-saved_at>ttl:
        _SETLIST_CACHE.pop(_setlist_cache_key(settings,show),None)
        return False,None
    return True,_setlist_with_favorites(row,favorites) if row else None

def _setlist_cache_put(settings,show,row):
    clean=None
    if row:
        clean=json.loads(json.dumps(row))
        clean.pop('favoriteSongHits',None)
    _SETLIST_CACHE[_setlist_cache_key(settings,show)]=(time.time(),clean)

def _setlist_for_show(ctx,settings,show,favorites):
    source=str(settings.get('setlistSource') or 'auto').lower();key=str(settings.get('setlistApiKey') or '').strip();errors=[]
    if ctx is not None:
        cached,row=_setlist_cache_get(settings,show,favorites)
        if cached:return row,errors
    providers=[]
    if source in ('auto','jerrybase'): providers.append(('JerryBase',lambda:_jerrybase_setlist(ctx,show,favorites)))
    if source in ('auto','relisten'): providers.append(('Relisten',lambda:_relisten_setlist(ctx,show,favorites)))
    if source in ('auto','archive'): providers.append(('Internet Archive',lambda:_archive_track_setlist(ctx,show,favorites)))
    if source=='setlistfm' or (source=='auto' and key): providers.append(('setlist.fm',lambda:_setlistfm_enrichment(ctx,key,show,favorites)))
    for name,fn in providers:
        try:
            row=fn()
            if row and row.get('sets'):
                if ctx is not None:_setlist_cache_put(settings,show,row)
                return row,errors
        except Exception as exc: errors.append(f'{name}: {str(exc)[:60]}')
    if ctx is not None and not errors:_setlist_cache_put(settings,show,None)
    return None,errors


def action(settings,context,action_name,payload):
    if action_name!='load-setlist':raise ValueError('Unsupported Deadhead action')
    date=_show_date((payload or {}).get('date'))
    if not date:raise ValueError('A valid show date is required')
    identifier=plain_text((payload or {}).get('identifier') or '',180)
    if identifier and not re.fullmatch(r'[A-Za-z0-9._-]{1,180}',identifier):identifier=''
    show={
        'date':date,'year':int(date[:4]),'identifier':identifier,
        'archiveUrl':f'https://archive.org/details/{quote(identifier)}' if identifier else 'https://archive.org/details/GratefulDead',
        'relistenUrl':f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',
        'jerrybaseUrl':f'https://jerrybase.com/events/{date.replace("-","")}-01',
    }
    favorites=_tokens(settings.get('favoriteSongs'))
    row,errors=_setlist_for_show(context,settings,show,favorites)
    return {'date':date,'available':bool(row and row.get('sets')),'setlist':row,'errors':errors[:4]}

def fetch(settings,context):
    today=datetime.datetime.now().astimezone().date();era=str(settings.get('era') or 'all').lower();provider_error=''
    try: shows=_archive_today(context,today)
    except Exception as exc: shows=[];provider_error=str(exc)[:80]
    if not shows: shows=_fallback_today(today)
    filtered=[x for x in shows if _era_ok(x['year'],era)]
    if filtered:shows=filtered
    shows=_order_shows(shows,settings,today)
    limit=_int(settings.get('showLimit'),1,40,12);shows=shows[:limit]
    featured_index=_featured_index(shows,settings,today);favorites=_tokens(settings.get('favoriteSongs'))
    display=_display_settings(settings);setlists={};setlist_errors=[]
    if display.get('setlistsEnabled',True) and shows:
        preload=min(len(shows),_int(settings.get('setlistPreload'),1,8,3))
        # Reuse setlists discovered by on-demand smart loading before spending more network requests.
        for show in shows:
            cached,row=_setlist_cache_get(settings,show,favorites)
            if cached and row:setlists[show['date']]=row
        indices=list(range(len(shows)))
        if featured_index>=0: indices=[featured_index]+[i for i in indices if i!=featured_index]
        # A failed lookup no longer consumes a preload slot: keep scanning until the requested
        # number of actual setlists is available, or every rotating show has been checked.
        for idx in indices:
            show=shows[idx]
            is_featured=(idx==featured_index)
            if len(setlists)>=preload and not (is_featured and show['date'] not in setlists):break
            if show['date'] in setlists:continue
            row,errors=_setlist_for_show(context,settings,show,favorites)
            if row:setlists[show['date']]=row
            setlist_errors.extend(errors)
    quotes=_quote_rows(settings,today) if display.get('quotesEnabled',True) else []
    return {
        'kind':'deadhead','provider':'JerryBase setlists · Relisten setlists/listening · Internet Archive listening','title':display.get('headerTitle') or 'Today in Dead History','date':today.isoformat(),'monthDay':today.strftime('%B %-d') if hasattr(today,'strftime') else today.isoformat(),
        'shows':shows,'featuredIndex':featured_index,'quotes':quotes,'quote':quotes[0] if quotes else None,'setlists':setlists,'setlist':setlists.get(shows[featured_index]['date']) if shows and featured_index>=0 else None,'setlistErrors':setlist_errors[:6],'providerError':provider_error,
        'era':era,'showMode':str(settings.get('showMode') or 'today'),'showOrder':str(settings.get('showOrder') or 'oldest'),'showBrowser':display.get('showBrowser','year-strip'),'autoRotate':display.get('autoRotate',True),'rotationSeconds':_int(display.get('rotationSeconds'),15,120,30),
        'quoteRotate':display.get('quoteRotate',True),'quoteSeconds':_int(display.get('quoteSeconds'),30,300,60),'quotePoolSize':len(quotes),'quoteOrder':str(display.get('quoteOrder') or 'daily-shuffle'),'visualMode':display.get('visualMode','subtle'),'favoriteSongs':favorites,'setlistsEnabled':display.get('setlistsEnabled',True),'setlistSource':display.get('setlistSource','auto'),'display':display,
        'unofficial':True,'sources':[{'label':'JerryBase setlists','url':'https://jerrybase.com/'},{'label':'Relisten setlists & listening','url':'https://relisten.net/grateful-dead'},{'label':'Internet Archive recordings','url':'https://archive.org/details/GratefulDead'},{'label':'The SetList Program','url':'https://www.setlists.net/'}]
    }
