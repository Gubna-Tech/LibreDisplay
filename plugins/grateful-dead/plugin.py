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
 'version': '2.0',
 'selfStyled': True,
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
     {'key': 'headerTitle', 'label': 'Header title', 'selector': '.deadhead-header-title', 'parent': 'headerCopy', 'order': 0},
     {'key': 'headerSubtitle', 'label': 'Header subtitle', 'selector': '.deadhead-header-subtitle', 'parent': 'headerCopy', 'order': 10},
     {'key': 'navPrevious', 'label': 'Previous button', 'selector': '.deadhead-prev', 'parent': 'navigation', 'order': 0},
     {'key': 'navPosition', 'label': 'Navigation position', 'selector': '.deadhead-nav-position', 'parent': 'navigation', 'order': 10},
     {'key': 'navNext', 'label': 'Next button', 'selector': '.deadhead-next', 'parent': 'navigation', 'order': 20},
     {'key': 'showTopline', 'label': 'Show counter / recordings', 'selector': '.deadhead-show-topline', 'parent': 'show', 'container': True, 'order': 0},
     {'key': 'showCounter', 'label': 'Show counter', 'selector': '.deadhead-show-kicker', 'parent': 'showTopline', 'order': 0},
     {'key': 'showRecordings', 'label': 'Recording count', 'selector': '.deadhead-recordings', 'parent': 'showTopline', 'order': 10},
     {'key': 'showDate', 'label': 'Performance date', 'selector': '.deadhead-show-date', 'parent': 'show', 'order': 10},
     {'key': 'showVenue', 'label': 'Venue / location', 'selector': '.deadhead-show-venue', 'parent': 'show', 'container': True, 'order': 20},
     {'key': 'showVenueName', 'label': 'Venue name', 'selector': '.deadhead-show-venue-name', 'parent': 'showVenue', 'order': 0},
     {'key': 'showLocation', 'label': 'Location', 'selector': '.deadhead-show-location', 'parent': 'showVenue', 'order': 10},
     {'key': 'showLinks', 'label': 'Source links', 'selector': '.deadhead-show-actions', 'parent': 'show', 'container': True, 'order': 30},
     {'key': 'weatherLabel', 'label': 'Weather pick label', 'selector': '.deadhead-weather-label', 'parent': 'weather', 'order': 0},
     {'key': 'weatherSong', 'label': 'Weather pick song', 'selector': '.deadhead-weather-song', 'parent': 'weather', 'order': 10},
     {'key': 'setlistHeading', 'label': 'Setlist heading / source', 'selector': '.deadhead-setlist-heading', 'parent': 'setlist', 'container': True, 'order': 0},
     {'key': 'setlistTitle', 'label': 'Setlist heading', 'selector': '.deadhead-setlist-title', 'parent': 'setlistHeading', 'order': 0},
     {'key': 'setlistSource', 'label': 'Setlist source', 'selector': '.deadhead-setlist-source', 'parent': 'setlistHeading', 'order': 10},
     {'key': 'setlistScroller', 'label': 'Setlist scrolling content', 'selector': '.deadhead-setlist-scroll', 'parent': 'setlist', 'container': True, 'order': 10},
     {'key': 'setlistBody', 'label': 'Sets and encore', 'selector': '.deadhead-setlist-body', 'parent': 'setlistScroller', 'container': True, 'order': 0},
     {'key': 'setlistFavorites', 'label': 'Favorite-song hits', 'selector': '.deadhead-favorites', 'parent': 'setlistScroller', 'order': 10},
     {'key': 'quoteKicker', 'label': 'Quote / lyric type', 'selector': '.deadhead-quote-kicker', 'parent': 'quote', 'container': True, 'order': 0},
     {'key': 'quoteText', 'label': 'Quote / lyric text', 'selector': '.deadhead-quote blockquote', 'parent': 'quote', 'order': 10},
     {'key': 'quoteContext', 'label': 'Quote / lyric context', 'selector': '.deadhead-quote-context', 'parent': 'quote', 'container': True, 'order': 20},
     {'key': 'quoteContextLabel', 'label': 'Context label', 'selector': '.deadhead-quote-context-label', 'parent': 'quoteContext', 'order': 0},
     {'key': 'quoteContextText', 'label': 'Context explanation', 'selector': '.deadhead-quote-context-text', 'parent': 'quoteContext', 'order': 10},
     {'key': 'quoteAttribution', 'label': 'Quote attribution', 'selector': '.deadhead-quote figcaption', 'parent': 'quote', 'container': True, 'order': 30},
     {'key': 'quoteMember', 'label': 'Quote member / song', 'selector': '.deadhead-quote-member', 'parent': 'quoteAttribution', 'order': 0},
     {'key': 'quoteSource', 'label': 'Quote source', 'selector': '.deadhead-quote-source', 'parent': 'quoteAttribution', 'order': 10},
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
               'label': 'Show quotes & lyric passages',
               'type': 'checkbox',
               'default': True,
               'section': 'Quotes',
               'sectionHelp': 'Rotate the full sourced quote and lyric catalog without repeating an item until the active pool is exhausted. Ordering, member filter, timing, and attribution are controlled independently.'},
              {'key': 'quoteContent',
               'label': 'Quote reel content',
               'type': 'select',
               'default': 'mixed',
               'options': [{'value': 'mixed', 'label': 'Member quotes + lyric passages'},
                           {'value': 'quotes', 'label': 'Member quotes only'},
                           {'value': 'lyrics', 'label': 'Lyric passages only'}],
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
              {'key': 'quoteRotate', 'label': 'Rotate quotes / lyric passages', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
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
              {'key': 'quoteShowMember', 'label': 'Show member / song name', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
              {'key': 'quoteShowContext',
               'label': 'Show quote / lyric context',
               'type': 'checkbox',
               'default': True,
               'section': 'Quotes',
               'help': 'Recommended. Adds a short plain-language explanation so brief excerpts are understandable instead of appearing as disconnected fragments.'},
              {'key': 'quoteShowType',
               'label': 'Show quote type label',
               'type': 'checkbox',
               'default': True,
               'section': 'Quotes',
               'help': 'Labels each item as a lyric passage or member quote before the text.'},
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
MANIFEST.update({'access': 'no-key', 'dataFlow': 'public-internet', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay requests public show, archive, setlist, and source material from public Internet services; the optional setlist.fm key is only used if configured.', 'freedomAlternative': 'Already freedom-first by default: core show/listening data works without an account or API key.'})

_DEADHEAD_PRESENTATION_RESPONSE_PATHS = {'showBrowser': ['display.showBrowser', 'showBrowser'], 'showBrowserEnabled': ['display.showBrowserEnabled'], 'browserMaxHeight': ['display.browserMaxHeight'], 'browserAutoScroll': ['display.browserAutoScroll'], 'browserScrollSpeed': ['display.browserScrollSpeed'], 'browserScrollStartDelay': ['display.browserScrollStartDelay'], 'browserScrollLoopPause': ['display.browserScrollLoopPause'], 'browserScrollLoopMode': ['display.browserScrollLoopMode'], 'browserScrollPauseOnHover': ['display.browserScrollPauseOnHover'], 'browserShowScrollbar': ['display.browserShowScrollbar'], 'browserShowVenue': ['display.browserShowVenue'], 'browserShowLocation': ['display.browserShowLocation'], 'autoRotate': ['display.autoRotate', 'autoRotate'], 'rotationSeconds': ['display.rotationSeconds', 'rotationSeconds'], 'pauseOnHover': ['display.pauseOnHover'], 'showHeader': ['display.showHeader'], 'showHeaderIcon': ['display.showHeaderIcon'], 'headerIcon': ['display.headerIcon'], 'headerTitle': ['display.headerTitle', 'title'], 'showHeaderSubtitle': ['display.showHeaderSubtitle'], 'showHeaderDate': ['display.showHeaderDate'], 'showHeaderShowCount': ['display.showHeaderShowCount'], 'headerSubtitle': ['display.headerSubtitle'], 'showUnofficialLabel': ['display.showUnofficialLabel'], 'showShowDetails': ['display.showShowDetails'], 'showShowCounter': ['display.showShowCounter'], 'showRecordingCount': ['display.showRecordingCount'], 'showDate': ['display.showDate'], 'dateStyle': ['display.dateStyle'], 'showVenue': ['display.showVenue'], 'showLocation': ['display.showLocation'], 'showNavigation': ['display.showNavigation'], 'navigationStyle': ['display.navigationStyle'], 'showPosition': ['display.showPosition'], 'showSourceLinks': ['display.showSourceLinks'], 'showJerryBaseLink': ['display.showJerryBaseLink'], 'jerrybaseLabel': ['display.jerrybaseLabel'], 'showArchiveLink': ['display.showArchiveLink'], 'archiveLabel': ['display.archiveLabel'], 'showRelistenLink': ['display.showRelistenLink'], 'relistenLabel': ['display.relistenLabel'], 'sourceLinkOrder': ['display.sourceLinkOrder'], 'linkStyle': ['display.linkStyle'], 'showWeatherPick': ['display.showWeatherPick'], 'weatherLabel': ['display.weatherLabel'], 'weatherClearSong': ['display.weatherClearSong'], 'weatherRainSong': ['display.weatherRainSong'], 'weatherSnowSong': ['display.weatherSnowSong'], 'weatherStormSong': ['display.weatherStormSong'], 'weatherFogSong': ['display.weatherFogSong'], 'weatherFallbackSong': ['display.weatherFallbackSong'], 'setlistSmartLoad': ['display.setlistSmartLoad'], 'setlistPreloadAhead': ['display.setlistPreloadAhead'], 'setlistHeading': ['display.setlistHeading'], 'setlistShowSource': ['display.setlistShowSource'], 'setlistShowMissing': ['display.setlistShowMissing'], 'setlistShowFavoriteHits': ['display.setlistShowFavoriteHits'], 'setlistHighlightFavorites': ['display.setlistHighlightFavorites'], 'setlistMaxSets': ['display.setlistMaxSets'], 'setlistSongsPerSet': ['display.setlistSongsPerSet'], 'setlistMaxHeight': ['display.setlistMaxHeight'], 'setlistAutoScroll': ['display.setlistAutoScroll'], 'setlistScrollSpeed': ['display.setlistScrollSpeed'], 'setlistScrollStartDelay': ['display.setlistScrollStartDelay'], 'setlistScrollLoopPause': ['display.setlistScrollLoopPause'], 'setlistScrollLoopMode': ['display.setlistScrollLoopMode'], 'setlistScrollPauseOnHover': ['display.setlistScrollPauseOnHover'], 'setlistShowScrollbar': ['display.setlistShowScrollbar'], 'quoteRotate': ['display.quoteRotate', 'quoteRotate'], 'quoteSeconds': ['display.quoteSeconds', 'quoteSeconds'], 'quoteStyle': ['display.quoteStyle'], 'quoteShowMarks': ['display.quoteShowMarks'], 'quoteShowMember': ['display.quoteShowMember'], 'quoteShowContext': ['display.quoteShowContext'], 'quoteShowType': ['display.quoteShowType'], 'quoteShowSource': ['display.quoteShowSource'], 'showFooter': ['display.showFooter'], 'showListenButton': ['display.showListenButton'], 'listenButtonLabel': ['display.listenButtonLabel'], 'listenButtonBehavior': ['display.listenButtonBehavior'], 'showRotationStatus': ['display.showRotationStatus'], 'showSetlistStatus': ['display.showSetlistStatus'], 'sectionOrder': ['display.sectionOrder'], 'density': ['display.density'], 'textAlign': ['display.textAlign'], 'panelSurface': ['display.panelSurface'], 'panelRadius': ['display.panelRadius'], 'panelPadding': ['display.panelPadding'], 'sectionGap': ['display.sectionGap'], 'titleScale': ['display.titleScale'], 'bodyScale': ['display.bodyScale'], 'showDecorations': ['display.showDecorations'], 'visualMode': ['display.visualMode', 'visualMode'], 'accentColor': ['display.accentColor'], 'accentColor2': ['display.accentColor2'], 'panelColor': ['display.panelColor'], 'textColor': ['display.textColor'], 'mutedColor': ['display.mutedColor'], 'accentStrength': ['display.accentStrength'], 'backgroundStrength': ['display.backgroundStrength']}
for _field in MANIFEST.get("settings") or []:
    _paths = _DEADHEAD_PRESENTATION_RESPONSE_PATHS.get(_field.get("key"))
    if _paths:
        _field.update({"cacheKey": False, "responsePaths": _paths})

# Keep only sourced passages that read coherently on their own. Fragmentary built-in lyric rows remain in the source catalog for provenance, but the unattended reel filters them out instead of inventing missing words.
BASE_LYRIC_PASSAGES=[
    {"key":"lyrics","kind":"lyric","member":"Franklin's Tower","quote":"May the four winds blow you safely home","source":"Dead.net lyrics","url":"https://www.dead.net/song/franklins-tower"},
    {"key":"lyrics","kind":"lyric","member":"Terrapin Station","quote":"Some rise, some fall, some climb to get to Terrapin","source":"Dead.net lyrics","url":"https://www.dead.net/song/terrapin-station"},
    {"key":"lyrics","kind":"lyric","member":"Scarlet Begonias","quote":"The sky was yellow and the sun was blue","source":"Dead.net lyrics","url":"https://www.dead.net/song/scarlet-begonias"},
    {"key":"lyrics","kind":"lyric","member":"Ramble On Rose","quote":"The grass ain't green, the wine ain't sweeter, either side of the hill","source":"Fan-favorite line · Ramble On Rose","url":"https://www.dead.net/song/ramble-rose"},
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

# The source catalog retains short direct excerpts for provenance, but the runtime
# reel now favors standalone lyric passages that make sense without the missing
# neighboring line. Fragmentary rows are kept out of unattended rotation.
EXTRA_LYRIC_PASSAGES=[
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
    {"key":"lyric-easy-wind","kind":"lyric","member":"Easy Wind","quote":"Gotta find a woman to be good to me. Won’t hide my liquor and try to serve me tea.","source":"Dead.net lyrics","url":"https://www.dead.net/songs"},
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


LYRIC_CONTEXT={
    "Althea":"A conversation about attraction, self-deception, and being warned that your own habits may be the biggest problem.",
    "Black Muddy River":"A late-period meditation on loneliness, endurance, and continuing forward when familiar supports are gone.",
    "Box of Rain":"A tender reflection on mortality, care, and the limits of what one person can give another in a difficult moment.",
    "Cassidy":"A layered song about birth, death, mentorship, and carrying someone else's memory into a new generation.",
    "Days Between":"A reflective look back across years of change, missed chances, love, and the strange distance created by time.",
    "Estimated Prophet":"A charismatic narrator becomes convinced of his own destiny, mixing spiritual certainty with grandiosity and delusion.",
    "Fire on the Mountain":"A warning that ambition and motion can become empty if you keep moving without noticing what is burning around you.",
    "Franklin's Tower":"A cyclical meditation on change, memory, and learning to keep moving when certainty and control are impossible.",
    "He's Gone":"A song about betrayal and loss that gradually becomes a broader statement about absence and accepting what cannot be restored.",
    "Help on the Way":"A tense but hopeful meditation on love, freedom, and trusting a path even when it cannot be fully explained.",
    "Ramble On Rose":"A playful collage of American names and images built around the idea of carrying on despite confusion and contradiction.",
    "Standing on the Moon":"A distant observer looks back at Earth and realizes that all the world's conflicts matter less than being near the person he misses.",
    "Stella Blue":"A worn-out musician surveys loss and disappointment, then finds a small measure of consolation in the music that remains.",
    "Terrapin Station":"A mythic storytelling cycle about inspiration, uncertainty, storytelling itself, and following a mysterious destination you cannot quite define.",
    "The Music Never Stopped":"A celebration of a band, a dancing crowd, and the way music can make an ordinary place feel transformed.",
    "The Wheel":"A meditation on momentum and consequence: once events are moving, no one can simply stop the larger cycle at will.",
    "Uncle John's Band":"A communal invitation to listen, participate, and find your place inside a group that is imperfect but still worth joining.",
    "Bertha":"A comic, restless narrator trying to stay one step ahead of trouble and consequences.",
    "Deal":"A gambling warning about knowing when to hold back before the stakes get out of hand.",
    "Brown-Eyed Women":"A family-memory vignette about hard times, homemade liquor, and survival through the Depression era.",
    "China Cat Sunflower":"A surreal stream of colorful images where the meaning comes from the dreamlike chain rather than one isolated phrase.",
    "St. Stephen":"A portrait of a wandering, mysterious figure whose choices attract fascination and complaint in equal measure.",
    "Casey Jones":"A darkly comic cautionary train story built around danger, speed, and impaired judgment.",
    "Sugar Magnolia":"An affectionate celebration of a free-spirited partner and the joy of being outdoors together.",
    "Friend of the Devil":"A fugitive narrator explains the debts, relationships, and bad choices keeping him on the run.",
    "Dire Wolf":"A frontier-style plea for mercy as danger closes in and the narrator realizes how exposed he is.",
    "U.S. Blues":"A playful, satirical tour through American symbols, patriotism, commerce, and contradiction.",
    "New Speedway Boogie":"A response to darkness and disorder that insists the situation eventually has to change.",
    "Wharf Rat":"A down-and-out character tells his story and still imagines a chance to recover and begin again.",
    "Brokedown Palace":"A tender farewell about leaving, returning home, and accepting the end of a journey.",
    "Loser":"A gambler boasts about the one hand that could change everything while sounding increasingly desperate.",
    "Jack Straw":"A tense outlaw narrative about partners on the road, shared responsibility, and violence catching up with them.",
    "Morning Dew":"A quiet post-catastrophe conversation where ordinary questions gradually reveal that the familiar world is gone.",
    "Playing in the Band":"A reflection on intuition, reason, freedom, and the strange logic of making music together.",
    "China Doll":"A fragile conversation after a fall, centered on guilt, fear, forgiveness, and whether someone can be saved.",
    "Row Jimmy":"A drifting character sketch about carrying on through uncertainty, setbacks, and emotional distance.",
    "Shakedown Street":"A challenge to the idea that a place has lost its soul, suggesting life is still there if you know how to look.",
    "Cosmic Charlie":"A playful send-off to a lovable eccentric whose wandering has finally gone on long enough.",
    "Candyman":"A dangerous charmer announces himself with gambling, bravado, and the threat of trouble following close behind.",
    "Doin' That Rag":"A psychedelic invitation full of wordplay, motion, and social performance rather than a literal narrative.",
    "Dupree's Diamond Blues":"A comic crime ballad about desire, robbery, bad decisions, and the consequences that follow.",
    "High Time":"A weary breakup conversation where affection remains even though the relationship is clearly failing.",
    "Black Peter":"A sick man watches friends gather around him and reflects on mortality with dry humor and resignation.",
    "Cumberland Blues":"A working-class mining song about wages, exhaustion, and having no real choice but to keep working.",
    "Easy Wind":"A rough-edged worker describes the kind of independent partner he wants: someone who accepts him without trying to domesticate him.",
    "Operator":"A lonely caller asks an operator for help reconnecting with someone he can no longer easily reach.",
    "Passenger":"A fast-moving invitation to travel, risk, and surrender to the ride rather than control it.",
    "Ship of Fools":"A warning about following foolish leaders and realizing too late that everyone aboard shares the consequences.",
    "Throwing Stones":"A political and social critique about power, conflict, environmental damage, and collective responsibility.",
    "West L.A. Fadeaway":"A noir-like Los Angeles story about deals, temptation, secrecy, and wanting a quiet place to disappear.",
    "Hell in a Bucket":"A sarcastic breakup song where the narrator embraces the chaos instead of pretending to be respectable.",
    "Foolish Heart":"Advice about protecting yourself from reckless love while admitting that the heart rarely follows sensible rules.",
    "Built to Last":"A meditation on what can endure through uncertainty, loss, and the passage of time.",
    "Liberty":"A late-period statement of independence about choosing freedom even when it comes with risk and loneliness.",
    "So Many Roads":"A weary traveler looks back on many paths and keeps searching for one that finally feels like home.",
    "Lazy River Road":"A nostalgic journey through remembered places, lost connections, and a landscape that feels half real and half dream.",
    "Corrina":"A hypnotic plea for connection, renewal, and waking a relationship back to life.",
    "Picasso Moon":"A dense, futuristic collage of technology, nightlife, media overload, and modern anxiety.",
    "Victim or the Crime":"A morally uneasy argument about blame, identity, and whether someone is suffering from or causing the damage around them.",
    "Weather Report Suite":"A broad cycle about changing weather, landscape, time, and the human urge to read meaning into natural patterns.",
    "Let It Grow":"A pastoral meditation on labor, seasons, fertility, and accepting that growth has its own timing.",
    "Feel Like a Stranger":"A charged encounter where attraction and uncertainty make the familiar world feel increasingly strange.",
    "Lost Sailor":"A sailor drifts without direction, using navigation imagery to describe uncertainty about purpose and belonging.",
    "Saint of Circumstance":"The companion to Lost Sailor: uncertainty turns into motion, risk, and deciding to go somewhere even without a clear destination.",
    "Alabama Getaway":"A sharp, fast-moving dismissal of a troublesome person whose presence brings complications and mistrust.",
    "Far From Me":"A relationship reaches its breaking point as one person accepts that emotional distance has become permanent.",
    "Blow Away":"A plea to let anger, pride, and emotional pressure dissipate before they destroy a relationship.",
    "Just a Little Light":"A hopeful request for enough clarity and warmth to get through confusion and darkness.",
    "Tons of Steel":"A humorous love song comparing an unpredictable relationship to operating an enormous, temperamental machine.",
    "My Brother Esau":"A biblical and psychological reflection on rivalry, violence, identity, and the darker impulses people carry.",
    "Might as Well":"A road-song celebration of embracing the ride, especially when the alternative is simply standing still.",
    "Crazy Fingers":"A dreamlike meditation on change, impermanence, love, and continuing forward when certainty disappears.",
    "Comes a Time":"A sober reflection on loneliness and the moment when avoiding emotional truth is no longer possible.",
    "The Eleven":"A rhythmic, mythic rush about transformation and crossing into a different state of awareness.",
    "Mountains of the Moon":"An old-world, storybook meditation on distance, mystery, status, and unreachable desire.",
    "Rosemary":"A miniature gothic scene about beauty, isolation, and a mysterious woman in an enclosed world.",
    "Alligator":"A comic psychedelic blues built around an unruly character, absurd threats, and escalating chaos.",
    "The Golden Road":"An invitation into the early counterculture world of dancing, travel, community, and possibility.",
    "Cream Puff War":"A relationship argument framed as a warning that jealousy and games can turn affection into conflict.",
    "Scarlet Begonias":"A chance street encounter turns into a reflection on attraction, coincidence, and noticing more than appearances.",
    "Ripple":"A philosophical reflection on inspiration, choice, and the limits of explaining where meaning comes from.",
    "Truckin'":"A road chronicle about touring, trouble, exhaustion, and realizing how strange the journey has become.",
    "Eyes of the World":"A reminder that awareness and renewal are already inside us, framed through images of nature and awakening.",
    "Touch of Grey":"A resilient, slightly cynical statement that things can be rough and still somehow be survivable.",
    "Sugaree":"A plea to keep distance from trouble and not let someone else's problems pull both people down.",
    "Bird Song":"A meditation on loss and remembrance that imagines a departed person continuing through nature and song.",
    "Attics of My Life":"A deeply grateful reflection on people who carry us when our own strength, language, or direction fails.",
    "Not Fade Away":"A direct declaration that love is enduring and refuses to disappear."
}

def _source_quote_context(source, member=''):
    src=str(source or '').lower()
    patterns=[
        ('howard rheingold', "improvisation, identity, technology, and the audience"),
        ("europe '72 denmark", "counterculture, independence, and the community around the music"),
        ('bill kreutzmann interview', "drumming, group interplay, touring, and authenticity"),
        ('phil lesh interview on kpfa', "composition, listening, education, and ensemble improvisation"),
        ('rolling stone', "band history, relationships, and public expectations"),
        ('adventures of pigpen', "Pigpen's blues roots and early role in the band"),
        ('deadcast · donna jean', "Donna Jean's singing, arrival, and touring years"),
        ("talkin' with donna jean", "Donna Jean's memories of performing and touring"),
        ('tom constanten', "the experimental late-1960s period and expanding musical vocabulary"),
        ('enter keith godchaux', "Keith Godchaux's arrival and the band's early-1970s transition"),
        ('sfgate', "life inside the band and its personal consequences"),
        ('jambands', "touring, musicianship, and improvised group chemistry"),
        ('grateful dead hour', "the band's music, history, and the period being discussed"),
        ('guitar player', "guitar, improvisation, responsibility, and ensemble listening"),
        ('deadcast · phil', "Phil Lesh's memories of musical development and key eras"),
        ('cincy groove', "communication, drumming, and improvised group chemistry"),
        ('phoenix new times', "joining the band and adapting to its intensity"),
        ('dead.net', "a first-person recollection from the band's history"),
    ]
    for token,context in patterns:
        if token in src:
            return context
    if 'grateful dead sources' in src:
        detail=str(source or '').replace('Grateful Dead Sources ·','').strip(' ·')
        return f"an archival {detail or 'Grateful Dead'} conversation"
    who=member or 'the band member'
    label=str(source or '').strip()
    if label:
        return f"{who}'s first-person perspective in the cited source"
    return f"{who}'s first-person recollection"

def _quote_topic(text, source='', member=''):
    q=str(text or '').lower()
    rules=[
        (("audience","deadhead","people who play the band","crowd"),"the relationship between the band and its audience"),
        (("play","music","musical","drum","guitar","sound","rhythm"),"playing music and what makes performance meaningful"),
        (("improvis","muse","creative","creativity","different"),"improvisation, creativity, and following an idea wherever it leads"),
        (("internet","record company","technology"),"how technology changes the relationship between artists and listeners"),
        (("fun","enjoy","love"),"the personal enjoyment and human side of making music"),
        (("early","warlocks","jerry","met"),"the band's early history and how its members came together"),
        (("life","whole","world","grow"),"a broader reflection on life and personal growth"),
        (("depression","dark"),"a difficult personal period and the attempt to move through it"),
        (("expectation","posing","integrity"),"authenticity and resisting outside expectations"),
    ]
    for terms,topic in rules:
        if any(term in q for term in terms): return topic
    return _source_quote_context(source,member)

def _contextualize_quote_row(row):
    out=dict(row)
    kind=str(out.get('kind') or 'quote')
    member=str(out.get('member') or '').strip()
    if kind=='lyric':
        out['context']=LYRIC_CONTEXT.get(member) or f"This passage comes from {member}; the song title is kept visible so the excerpt stays connected to the larger narrative rather than reading like an isolated phrase."
        out['contextLabel']='Passage context'
    else:
        topic=_quote_topic(out.get('quote'),out.get('source'),member)
        if topic.startswith(member) or topic.startswith('the band member'):
            out['context']=topic[0].upper()+topic[1:]+'.'
        else:
            out['context']=f"{member} on {topic}." if member else f"Context: {topic}."
        out['contextLabel']='Passage context'
    return out


# Context stays deliberately compact. The quote/lyric itself should carry the card;
# this one-sentence context is only a short orientation aid, not a second essay.
_CONTEXT_LENSES = [("context", "Context", "{base}")]

def _expand_contextual_rotation(rows):
    out=[]
    for row in rows:
        item=_contextualize_quote_row(row)
        item['rotationKey']=f"{item.get('kind','quote')}|{item.get('member','')}|{item.get('key','')}|context|{item.get('quote','')}"
        item['contextLabel']='Context'
        out.append(item)
    return out
MEMBER_QUOTES=[{'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'All it takes to create another reality is people living in it.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'We fantasized about a different reality.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'We concentrated on our own reality.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "We don't respond to the press or television.",
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Whatever makes Grateful Dead run is something continuous.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "There are a lot of things that can't be preached.",
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'I have no special place to guide anyone to.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "I don't mind being a kind of guide.",
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "Why should I know more than others about what's happening?",
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'There is something greater than me.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'It is bigger than all of us.',
  'source': "Deadcast · Europe '72 Denmark",
  'url': 'https://www.dead.net/deadcast/rewind-europe-72-denmark',
  'provenance': 'official-archive'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'I approach interviews the same way I approach music.',
  'source': 'Grateful Dead Sources · April 11, 1972',
  'url': 'https://deadsources.blogspot.com/2014/09/april-11-1972-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "It's improvisational.",
  'source': 'Grateful Dead Sources · April 11, 1972',
  'url': 'https://deadsources.blogspot.com/2014/09/april-11-1972-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'I depend on what kind of feed I get.',
  'source': 'Grateful Dead Sources · April 11, 1972',
  'url': 'https://deadsources.blogspot.com/2014/09/april-11-1972-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "I'm surprised at our success.",
  'source': 'Grateful Dead Sources · March 20, 1981',
  'url': 'https://deadsources.blogspot.com/2021/04/march-20-1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Shit, I would pay to play music.',
  'source': 'Grateful Dead Sources · March 20, 1981',
  'url': 'https://deadsources.blogspot.com/2021/04/march-20-1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "I'd enjoy it whether we were obscure or hugely successful.",
  'source': 'Grateful Dead Sources · March 20, 1981',
  'url': 'https://deadsources.blogspot.com/2021/04/march-20-1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'I want it to be the full range.',
  'source': 'Grateful Dead Sources · March 20, 1981',
  'url': 'https://deadsources.blogspot.com/2021/04/march-20-1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "Fuck 'em if they can't take a joke.",
  'source': 'Grateful Dead Sources · Fall 1977',
  'url': 'https://deadsources.blogspot.com/2021/04/fall-1977-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Everything is allowed.',
  'source': 'Grateful Dead Sources · Fall 1977',
  'url': 'https://deadsources.blogspot.com/2021/04/fall-1977-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "We've never spared the audience.",
  'source': 'Grateful Dead Sources · Fall 1977',
  'url': 'https://deadsources.blogspot.com/2021/04/fall-1977-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "We've played much weirder shit than this.",
  'source': 'Grateful Dead Sources · Fall 1977',
  'url': 'https://deadsources.blogspot.com/2021/04/fall-1977-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "Live music is where it's at for us.",
  'source': 'Grateful Dead Sources · 1981 X Factor',
  'url': 'https://deadsources.blogspot.com/2024/03/1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Our idea of performance is what we do live.',
  'source': 'Grateful Dead Sources · 1981 X Factor',
  'url': 'https://deadsources.blogspot.com/2024/03/1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Making records is a concession to the music business.',
  'source': 'Grateful Dead Sources · 1981 X Factor',
  'url': 'https://deadsources.blogspot.com/2024/03/1981-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'The pursuit of happiness is the basic, ultimate freedom.',
  'source': 'CMG Worldwide · Jerry Garcia estate biography',
  'url': 'https://www.cmgworldwide.com/clients/jerry-garcia/',
  'provenance': 'official-estate-source'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Constantly choosing the lesser of two evils is still choosing evil.',
  'source': 'CMG Worldwide · Jerry Garcia estate biography',
  'url': 'https://www.cmgworldwide.com/clients/jerry-garcia/',
  'provenance': 'official-estate-source'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Music is a good way to encapsulate a lot of it.',
  'source': "Jerry Garcia · Jerry's Story",
  'url': 'https://www.media.jerrygarcia.com/jerrys-story/',
  'provenance': 'official-artist-site'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'You have to allow it to happen.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "The nature of what we're doing is non-formulaic.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Music goes way back before language does.',
  'source': 'Grateful Dead Sources · Guitar Player interview · 1971',
  'url': 'https://deadsources.blogspot.com/2014/03/early-1971-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'Music is like the key to a spiritual existence.',
  'source': 'Grateful Dead Sources · Guitar Player interview · 1971',
  'url': 'https://deadsources.blogspot.com/2014/03/early-1971-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'You start recognizing habits; then you have to break them.',
  'source': 'Grateful Dead Sources · Guitar Player interview · 1971',
  'url': 'https://deadsources.blogspot.com/2014/03/early-1971-jerry-garcia-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "There's so much great music that's already happened.",
  'source': 'Deadcast · Friend of the Devils: Virginia, 4/78',
  'url': 'https://www.dead.net/friend-devils-virginia-478',
  'provenance': 'official-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': 'I think that guitar playing is in an incredible state right now.',
  'source': 'Deadcast · Friend of the Devils: Virginia, 4/78',
  'url': 'https://www.dead.net/friend-devils-virginia-478',
  'provenance': 'official-transcript'},
 {'key': 'jerry',
  'kind': 'quote',
  'member': 'Jerry Garcia',
  'quote': "We didn't want to go through that experience again.",
  'source': "Deadcast · Workingman's Dead 50: Uncle John's Band",
  'url': 'https://www.dead.net/workingmans-dead-50-uncle-johns-band',
  'provenance': 'official-transcript'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "We've always been pretty free to do the things we want.",
  'source': 'Grateful Dead Sources · November 1972',
  'url': 'https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "We've always had 100% artistic control.",
  'source': 'Grateful Dead Sources · November 1972',
  'url': 'https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "There's not much they can tell us not to do.",
  'source': 'Grateful Dead Sources · November 1972',
  'url': 'https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'It developed into what I wanted in the first place.',
  'source': 'Grateful Dead Sources · May 1972',
  'url': 'https://deadsources.blogspot.com/2022/05/may-1972-bob-weir-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'I got him right square on the head.',
  'source': 'Grateful Dead Hour 370',
  'url': 'https://www.dead.net/features/gd-radio-hour/grateful-dead-hour-no-370',
  'provenance': 'official-archive'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'What was I gonna do with this water balloon?',
  'source': 'Grateful Dead Hour 370',
  'url': 'https://www.dead.net/features/gd-radio-hour/grateful-dead-hour-no-370',
  'provenance': 'official-archive'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "We're just inviting adventure into our life.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Adventure carries a little baggage.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Everybody has something to bring to the table.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Bicycles are almost as good as guitars for meeting girls.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "Grace isn't enough.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "You've got to intend to be there when it's happening.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Dynamic benign neglect.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Slowly you become your own man.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "Sometimes the magic works and sometimes it doesn't.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Our lives are interesting.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'The bulk of my input comes from my peers.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'We have cultural depth.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'We get all kinds of stuff to chew on.',
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "Certain kinds of people just can't live life taking risks.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'The same song on a different day was a different song.',
  'source': "CNN/WTVR · Bob Weir's long strange trip · 2014",
  'url': 'https://www.wtvr.com/2014/04/25/the-grateful-dead-and-bob-weirs-long-strange-trip',
  'provenance': 'contemporary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'More fun than a frog in a glass of milk.',
  'source': 'Bob Weir · Wolf Bros tour announcement · 2019',
  'url': 'https://bobweir.net/bob-weir-and-wolf-bros-announce-early-2020-shows/',
  'provenance': 'official-artist-site'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "The pervasive attitude is that it's crazy to invite danger.",
  'source': 'Howard Rheingold · Jerry Garcia & Bob Weir interview · 1991',
  'url': 'https://hrheingold.medium.com/interview-with-jerry-garcia-bob-weir-april-16-1991-dff48d26f0af',
  'provenance': 'primary-interview'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': 'Been too long.',
  'source': 'Bob Weir · Red Rocks / Vail announcement · 2021',
  'url': 'https://bobweir.net/bob-weir-and-wolf-bros-confirm-red-rocks-amphitheatre-vail-co-dates/',
  'provenance': 'official-artist-site'},
 {'key': 'bob',
  'kind': 'quote',
  'member': 'Bob Weir',
  'quote': "There's a rawness to it that we'll prolly never get again.",
  'source': 'Bob Weir · Live in Colorado Vol. 2 · 2022',
  'url': 'https://bobweir.net/bobby-weir-wolf-bros-live-in-colorado-vol-2-out-october-7-on-third-man-records/',
  'provenance': 'official-artist-site'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'The structural techniques seemed infinitely applicable.',
  'source': 'Deadcast · Phil 85 Part 1',
  'url': 'https://www.dead.net/phil-85-part-1',
  'provenance': 'official-archive'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'It was a lot of fun.',
  'source': 'Deadcast · Phil 85 Part 1',
  'url': 'https://www.dead.net/phil-85-part-1',
  'provenance': 'official-archive'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'A prettier shot you never saw.',
  'source': 'Grateful Dead Hour 370',
  'url': 'https://www.dead.net/features/gd-radio-hour/grateful-dead-hour-no-370',
  'provenance': 'official-archive'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': "If you're dancing to it, it'll sure fuck you up.",
  'source': 'Dead.net · Blues for Allah 50',
  'url': 'https://www.dead.net/blues-allah-50-king-solomons-marblesstronger-dirt',
  'provenance': 'official-archive'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'It seemed logical to apply those structural techniques.',
  'source': 'Deadcast · Phil 85 Part 1',
  'url': 'https://www.dead.net/phil-85-part-1',
  'provenance': 'official-archive'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'To sing a simple round is truly an enlightening experience.',
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'There was always so much encouragement from Deadheads.',
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'We need to support the arts in schools.',
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'Everything we ever did demonstrated the value of cross-fertilization.',
  'source': 'Rolling Stone interview · archival reprint',
  'url': 'https://weirfreak.blogspot.com/2005/08/',
  'provenance': 'archival-interview-reprint'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'We had all these different influences.',
  'source': 'Rolling Stone interview · archival reprint',
  'url': 'https://weirfreak.blogspot.com/2005/08/',
  'provenance': 'archival-interview-reprint'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'Bobby Weir used to call it electric Dixieland.',
  'source': 'Rolling Stone interview · archival reprint',
  'url': 'https://weirfreak.blogspot.com/2005/08/',
  'provenance': 'archival-interview-reprint'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': "Nobody told us we couldn't do it.",
  'source': 'Rolling Stone interview · archival reprint',
  'url': 'https://weirfreak.blogspot.com/2005/08/',
  'provenance': 'archival-interview-reprint'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'I wanted our music to be jaw-dropping.',
  'source': 'Rolling Stone interview · archival reprint',
  'url': 'https://weirfreak.blogspot.com/2005/08/',
  'provenance': 'archival-interview-reprint'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'Jerry Garcia was behind it the whole way.',
  'source': 'Rolling Stone interview · archival reprint',
  'url': 'https://weirfreak.blogspot.com/2005/08/',
  'provenance': 'archival-interview-reprint'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'The Deadheads are the people who play the band.',
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': "I'm open.",
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'We can guarantee that.',
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'phil',
  'kind': 'quote',
  'member': 'Phil Lesh',
  'quote': 'Turn the lights down low and the sound up.',
  'source': 'Phil Lesh interview on KPFA · 1997',
  'url': 'https://www.philzone.com/philbase/gans-lesh_970402.html',
  'provenance': 'primary-interview'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'The groove is right; the rhythm is right.',
  'source': 'Mickey Hart · Good Vibrations Q&A',
  'url': 'https://mickeyhart.net/news/good-vibrations-qa-mickey-hart-444/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Every star, every planet sings its own song.',
  'source': 'Mickey Hart · Good Vibrations Q&A',
  'url': 'https://mickeyhart.net/news/good-vibrations-qa-mickey-hart-444/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'My whole life is about rhythm.',
  'source': 'Mickey Hart · The Brain Is Rhythm Central',
  'url': 'https://mickeyhart.net/news/drummer-mickey-hart-has-rhythm-mind-672/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Music has to happen in the moment.',
  'source': 'Mickey Hart · The Brain Is Rhythm Central',
  'url': 'https://mickeyhart.net/news/drummer-mickey-hart-has-rhythm-mind-672/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Being able to follow the muse is a real privilege.',
  'source': 'Mickey Hart · The Brain Is Rhythm Central interview',
  'url': 'https://mickeyhart.net/news/grateful-dead-s-drummer-mickey-hart-the-brain-is-rhythm-central-419/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Rhythm and vibrations are the basis of all life.',
  'source': 'Mickey Hart · The Brain Is Rhythm Central interview',
  'url': 'https://mickeyhart.net/news/grateful-dead-s-drummer-mickey-hart-the-brain-is-rhythm-central-419/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Rhythm made me feel whole.',
  'source': 'Mickey Hart · Concert Preview interview',
  'url': 'https://mickeyhart.net/news/concert-preview-grateful-deads-mickey-hart-headlines-festival-408/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Rhythmic vibration is at the basis of all life.',
  'source': 'Mickey Hart · Concert Preview interview',
  'url': 'https://mickeyhart.net/news/concert-preview-grateful-deads-mickey-hart-headlines-festival-408/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Our early years were some of the most exciting times for me.',
  'source': 'Mickey Hart · Throwback Thursday · first Grateful Dead show',
  'url': 'https://mickeyhart.net/news/throwback-thursday-september-29th-1967-my-first-show-jerry-and-boys-5456/',
  'provenance': 'official-artist-site'},
 {'key': 'mickey',
  'kind': 'quote',
  'member': 'Mickey Hart',
  'quote': 'Our creative juices knew no bounds.',
  'source': 'Mickey Hart · Throwback Thursday · first Grateful Dead show',
  'url': 'https://mickeyhart.net/news/throwback-thursday-september-29th-1967-my-first-show-jerry-and-boys-5456/',
  'provenance': 'official-artist-site'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'I am just a guy who plays drums.',
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': "I saw a drummer play and thought, that's really cool.",
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'I tried it and I loved it.',
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': "I don't care about posing.",
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'I care about being able to play.',
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'Playing with integrity is what matters.',
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': "I'd rather play here in this small bar.",
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': "There's no expectations; it's encouragement to be different.",
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': "We're doing this for fun.",
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'I love the farm, I love growing stuff.',
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'The internet takes out the middle man.',
  'source': 'Cincy Groove · Bill Kreutzmann interview',
  'url': 'https://cincygroove.com/2009/05/20/interview-with-bill-kreutzmann-from-the-grateful-dead-and-bk3/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'It lets the artist be their own record company.',
  'source': 'Cincy Groove · Bill Kreutzmann interview',
  'url': 'https://cincygroove.com/2009/05/20/interview-with-bill-kreutzmann-from-the-grateful-dead-and-bk3/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'The Dead is some kind of contact with an audience.',
  'source': 'Grateful Dead Sources · Spring 1972',
  'url': 'https://deadsources.blogspot.com/2014/09/spring-1972-weir-kreutzmann-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'Communication is terribly important.',
  'source': 'Cincy Groove · Bill Kreutzmann interview',
  'url': 'https://cincygroove.com/2009/05/20/interview-with-bill-kreutzmann-from-the-grateful-dead-and-bk3/',
  'provenance': 'primary-interview'},
 {'key': 'bill',
  'kind': 'quote',
  'member': 'Bill Kreutzmann',
  'quote': 'I just wanted to play the drums.',
  'source': 'JamBands · Bill Kreutzmann interview · 1999',
  'url': 'https://jambands.com/features/1999/03/15/just-a-guy-who-plays-drums-an-interview-with-bill-kreutzmann/2/',
  'provenance': 'primary-interview'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': "The whole early Kepler's scene — that's when I met Jerry.",
  'source': 'Deadcast · Adventures of Pigpen Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-archive'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': "And then I'd sing and play harmonica.",
  'source': 'Deadcast · Adventures of Pigpen Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-archive'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'Way before the Warlocks.',
  'source': 'Deadcast · Adventures of Pigpen Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-archive'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'Not my fault, Jerry gave it to me.',
  'source': 'Grateful Dead Sources · 1966 radio interview',
  'url': 'https://deadsources.blogspot.com/2012/02/1966-radio-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'Then you gotta sort it out.',
  'source': 'Deadcast · The Adventures of Pigpen, Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-transcript'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'And good luck.',
  'source': 'Deadcast · The Adventures of Pigpen, Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-transcript'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'Perry Lane was really fun.',
  'source': 'Deadcast · The Adventures of Pigpen, Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-transcript'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'It was a good trip.',
  'source': 'Deadcast · The Adventures of Pigpen, Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-transcript'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': 'Electric bass.',
  'source': 'Deadcast · The Adventures of Pigpen, Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-transcript'},
 {'key': 'pigpen',
  'kind': 'quote',
  'member': 'Ron “Pigpen” McKernan',
  'quote': "It's on.",
  'source': 'Deadcast · The Adventures of Pigpen, Part 1',
  'url': 'https://www.dead.net/adventures-pigpen-part-1',
  'provenance': 'official-transcript'},
 {'key': 'tom',
  'kind': 'quote',
  'member': 'Tom Constanten',
  'quote': 'We sort of threw the spaghetti at the wall.',
  'source': 'Grateful Web interview',
  'url': 'https://www.gratefulweb.com/articles/we-sort-of-threw-spaghetti-at-the-wall-an-interview-with-tom-constanten-of-the-grateful-dead/',
  'provenance': 'primary-interview'},
 {'key': 'tom',
  'kind': 'quote',
  'member': 'Tom Constanten',
  'quote': 'It was a continual party.',
  'source': 'Deadcast · Tom Constanten archival interview',
  'url': 'https://www.dead.net/tc',
  'provenance': 'official-transcript'},
 {'key': 'tom',
  'kind': 'quote',
  'member': 'Tom Constanten',
  'quote': 'It happened just spur of the moment.',
  'source': 'Deadcast · Tom Constanten archival interview',
  'url': 'https://www.dead.net/tc',
  'provenance': 'official-transcript'},
 {'key': 'tom',
  'kind': 'quote',
  'member': 'Tom Constanten',
  'quote': "It's an academic piece actually.",
  'source': 'Deadcast · Tom Constanten archival interview',
  'url': 'https://www.dead.net/tc',
  'provenance': 'official-transcript'},
 {'key': 'tom',
  'kind': 'quote',
  'member': 'Tom Constanten',
  'quote': "We're all in our orbits.",
  'source': 'Deadcast · Tom Constanten archival interview',
  'url': 'https://www.dead.net/tc',
  'provenance': 'official-transcript'},
 {'key': 'tom',
  'kind': 'quote',
  'member': 'Tom Constanten',
  'quote': "We don't see boundaries or classifications.",
  'source': 'Grateful Web · Tom Constanten & Bob Bralove interview · 2014',
  'url': 'https://www.gratefulweb.com/articles/grateful-web-interview-with-tom-constanten-bob-bralove/',
  'provenance': 'primary-interview'},
 {'key': 'keith',
  'kind': 'quote',
  'member': 'Keith Godchaux',
  'quote': "I don't want to listen to it. I want to play it.",
  'source': 'Deadcast · Enter Keith Godchaux',
  'url': 'https://www.dead.net/enter-keith-godchaux',
  'provenance': 'official-oral-history'},
 {'key': 'keith',
  'kind': 'quote',
  'member': 'Keith Godchaux',
  'quote': "Yeah, I didn't know how to play it.",
  'source': 'Deadcast · Enter Keith Godchaux',
  'url': 'https://www.dead.net/enter-keith-godchaux',
  'provenance': 'official-transcript'},
 {'key': 'keith',
  'kind': 'quote',
  'member': 'Keith Godchaux',
  'quote': "Yeah I'm starting to get turned on to different textures.",
  'source': 'Deadcast · Enter Keith Godchaux',
  'url': 'https://www.dead.net/enter-keith-godchaux',
  'provenance': 'official-transcript'},
 {'key': 'keith',
  'kind': 'quote',
  'member': 'Keith Godchaux',
  'quote': 'Hunter and I wrote that.',
  'source': 'Deadcast · Enter Keith Godchaux',
  'url': 'https://www.dead.net/enter-keith-godchaux',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': "When I sing again, it's going to be with that band.",
  'source': 'Deadcast · Donna Jean',
  'url': 'https://www.dead.net/donna-jean',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'All hell broke loose!',
  'source': 'Deadcast · Donna Jean',
  'url': 'https://www.dead.net/donna-jean',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'It was an adventure.',
  'source': 'Deadcast · Donna Jean',
  'url': 'https://www.dead.net/donna-jean',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'They were magical.',
  'source': 'Deadcast · Donna Jean',
  'url': 'https://www.dead.net/donna-jean',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'How do they do that?',
  'source': 'Deadcast · Donna Jean',
  'url': 'https://www.dead.net/donna-jean',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'The whole thing was magical.',
  'source': 'Deadcast · Donna Jean',
  'url': 'https://www.dead.net/donna-jean',
  'provenance': 'official-transcript'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'I loved it!',
  'source': "Dead.net · Talkin' With Donna Jean Godchaux · 2014",
  'url': 'https://www.dead.net/features/back-around/talkin-donna-jean-godchaux',
  'provenance': 'primary-interview'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'Evolved is the operative word.',
  'source': "Dead.net · Talkin' With Donna Jean Godchaux · 2014",
  'url': 'https://www.dead.net/features/back-around/talkin-donna-jean-godchaux',
  'provenance': 'primary-interview'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'It was fun.',
  'source': "Dead.net · Talkin' With Donna Jean Godchaux · 2014",
  'url': 'https://www.dead.net/features/back-around/talkin-donna-jean-godchaux',
  'provenance': 'primary-interview'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'I think we did that.',
  'source': "Dead.net · Talkin' With Donna Jean Godchaux · 2014",
  'url': 'https://www.dead.net/features/back-around/talkin-donna-jean-godchaux',
  'provenance': 'primary-interview'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'And we just love these songs. Period.',
  'source': "Dead.net · Talkin' With Donna Jean Godchaux · 2014",
  'url': 'https://www.dead.net/features/back-around/talkin-donna-jean-godchaux',
  'provenance': 'primary-interview'},
 {'key': 'donna',
  'kind': 'quote',
  'member': 'Donna Jean Godchaux',
  'quote': 'My pleasure!',
  'source': "Dead.net · Talkin' With Donna Jean Godchaux · 2014",
  'url': 'https://www.dead.net/features/back-around/talkin-donna-jean-godchaux',
  'provenance': 'primary-interview'},
 {'key': 'brent',
  'kind': 'quote',
  'member': 'Brent Mydland',
  'quote': "There are people who like me and people who don't.",
  'source': 'The Golden Road interview, quoted by Phoenix New Times',
  'url': 'https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/',
  'provenance': 'contemporary-interview-reprint'},
 {'key': 'brent',
  'kind': 'quote',
  'member': 'Brent Mydland',
  'quote': "I think I'm beginning to catch on.",
  'source': 'Grateful Dead Sources · Musician interview · 1981',
  'url': 'https://deadsources.blogspot.com/2024/03/1981-grateful-dead-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'brent',
  'kind': 'quote',
  'member': 'Brent Mydland',
  'quote': 'Of course not!',
  'source': 'Grateful Dead Sources · Musician interview · 1981',
  'url': 'https://deadsources.blogspot.com/2024/03/1981-grateful-dead-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'brent',
  'kind': 'quote',
  'member': 'Brent Mydland',
  'quote': 'Are you trying to get me in trouble or something?',
  'source': 'Grateful Dead Sources · Musician interview · 1981',
  'url': 'https://deadsources.blogspot.com/2024/03/1981-grateful-dead-interview.html',
  'provenance': 'archival-transcript'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': "They're very much a family.",
  'source': 'Phoenix New Times interview · 1995',
  'url': 'https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': 'I felt really good.',
  'source': 'Phoenix New Times interview · 1995',
  'url': 'https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': "I was just hoping they wouldn't start throwing things at me.",
  'source': 'Phoenix New Times interview · 1995',
  'url': 'https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': 'It was hideous.',
  'source': 'SFGATE interview · 1998',
  'url': 'https://www.sfgate.com/entertainment/article/chrome-making-noise-again-3008583.php',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': "I didn't know if I was going to play again.",
  'source': 'SFGATE interview · 1998',
  'url': 'https://www.sfgate.com/entertainment/article/chrome-making-noise-again-3008583.php',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': 'It turned out to be a beautiful world.',
  'source': 'SFGATE interview · 1998',
  'url': 'https://www.sfgate.com/entertainment/article/chrome-making-noise-again-3008583.php',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': "I'm clueless.",
  'source': 'SFGATE interview · 1998',
  'url': 'https://www.sfgate.com/entertainment/article/chrome-making-noise-again-3008583.php',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': 'The depression just kept coming on.',
  'source': "SFGATE · Dead's Welnick Out of the Dark · 1996",
  'url': 'https://www.sfgate.com/bayarea/article/lively-arts-nightlife-dead-s-welnick-out-of-2963995.php',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': "It's more than my personal thing.",
  'source': "SFGATE · Dead's Welnick Out of the Dark · 1996",
  'url': 'https://www.sfgate.com/bayarea/article/lively-arts-nightlife-dead-s-welnick-out-of-2963995.php',
  'provenance': 'contemporary-interview'},
 {'key': 'vince',
  'kind': 'quote',
  'member': 'Vince Welnick',
  'quote': "It's all just a big, beautiful world now.",
  'source': "SFGATE · Dead's Welnick Out of the Dark · 1996",
  'url': 'https://www.sfgate.com/bayarea/article/lively-arts-nightlife-dead-s-welnick-out-of-2963995.php',
  'provenance': 'contemporary-interview'}]
QUOTES=MEMBER_QUOTES+BASE_LYRIC_PASSAGES

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
    for line in str(value or '').splitlines()[:1000]:
        parts=[x.strip() for x in line.split('|',2)]
        if len(parts)<2 or not parts[0] or not parts[1]: continue
        url=parts[2] if len(parts)>2 and re.match(r'^https?://',parts[2],re.I) else ''
        out.append({"key":"custom","kind":"quote","member":plain_text(parts[0],60),"quote":plain_text(parts[1],800),"source":"Personal quote pack","url":url})
    return out

def _balanced_member_quote_rows(items,today,order):
    """Round-robin the daily quote reel across represented members.

    Catalog order remains literal for users who explicitly request it. Daily
    shuffle first randomizes each member's own material, then rotates the
    member starting point by date so no member permanently owns the first slot.
    Unknown/custom member keys participate as their own buckets.
    """
    items=list(items)
    if order=='catalog' or len(items)<2:
        return items
    buckets={}
    for row in items:
        key=str(row.get('key') or 'other').lower()
        buckets.setdefault(key,[]).append(row)
    keys=[key for key in MEMBER_ORDER if key in buckets]
    keys.extend(sorted(key for key in buckets if key not in MEMBER_ORDER))
    if len(keys)>1:
        seed=today.isoformat()+'|deadhead-member-cycle'
        offset=int(hashlib.sha256(seed.encode()).hexdigest()[:8],16)%len(keys)
        keys=keys[offset:]+keys[:offset]
    out=[]
    depth=0
    while True:
        added=False
        for key in keys:
            bucket=buckets[key]
            if depth<len(bucket):
                out.append(bucket[depth]);added=True
        if not added:
            break
        depth+=1
    return out

def _quote_word_count(value):
    return len(re.findall(r"\b[\w’'-]+\b",str(value or '')))

LYRIC_COMPLETE_SHORT_ALLOWLIST={
    'Touch of Grey',
    "Truckin'",
    'Deal',
    'St. Stephen',
    'Not Fade Away',
    'Row Jimmy',
    'Cosmic Charlie',
    'Cream Puff War',
    'Victim or the Crime',
}

def _quote_has_standalone_context(row):
    # Personal packs are user-authored and should not be second-guessed. Built-in
    # lyric material is held to a stronger standard: prefer full standalone lines
    # and exclude tiny half-lines/fragments rather than padding them with invented
    # words. A small explicit allowlist preserves short, complete iconic lines.
    if str(row.get('source') or '')=='Personal quote pack' or str(row.get('key') or '')=='custom':
        return True
    words=_quote_word_count(row.get('quote'))
    if str(row.get('kind') or 'quote')=='lyric':
        return words >= 8 or (words >= 7 and str(row.get('member') or '') in LYRIC_COMPLETE_SHORT_ALLOWLIST)
    return words >= 5

def _quote_rows(settings,today):
    rows=[_contextualize_quote_row(x) for x in (QUOTES+EXTRA_LYRIC_PASSAGES+_custom_quotes(settings.get('customQuotes'))) if _quote_has_standalone_context(x)]
    # Keep one concise contextual card per source passage. Non-catalog rotation adds
    # only a stable rotation key; it no longer multiplies each excerpt into lens essays.
    if str(settings.get('quoteOrder') or 'daily-shuffle').lower()!='catalog':
        rows=_expand_contextual_rotation(rows)
    deduped=[];seen=set()
    for row in rows:
        sig=(str(row.get('rotationKey') or ''),str(row.get('kind') or ''),str(row.get('member') or '').casefold(),str(row.get('quote') or '').casefold(),str(row.get('context') or '').casefold())
        if sig in seen: continue
        seen.add(sig);deduped.append(row)
    rows=deduped
    content=str(settings.get('quoteContent') or 'mixed').lower()
    if content not in ('mixed','quotes','lyrics'):
        content='mixed'
    member=str(settings.get('quoteMember') or 'all').lower()
    quote_rows=[x for x in rows if x.get('kind','quote')=='quote']
    lyric_rows=[x for x in rows if x.get('kind')=='lyric']
    if member!='all':
        filtered=[x for x in quote_rows if x.get('key')==member]
        if filtered: quote_rows=filtered
    order=str(settings.get('quoteOrder') or 'daily-shuffle').lower()
    def ordered(items, kind):
        items=list(items)
        if order!='catalog' and items:
            seed=today.isoformat()+member+content+'|'+kind
            items.sort(key=lambda x:hashlib.sha256((seed+'|'+str(x.get('member'))+'|'+str(x.get('quote'))).encode()).hexdigest())
        return items
    quote_rows=ordered(quote_rows,'quote');lyric_rows=ordered(lyric_rows,'lyric')
    if member=='all': quote_rows=_balanced_member_quote_rows(quote_rows,today,order)
    if content=='quotes': return quote_rows
    if content=='lyrics': return lyric_rows
    # Mixed alternates while both categories have material, then exhausts the
    # larger category exactly once. No source passage is duplicated just to make
    # the categories numerically equal.
    if not quote_rows: return lyric_rows
    if not lyric_rows: return quote_rows
    mixed=[];count=max(len(quote_rows),len(lyric_rows))
    for i in range(count):
        if i < len(quote_rows): mixed.append(quote_rows[i])
        if i < len(lyric_rows): mixed.append(lyric_rows[i])
    return mixed

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
