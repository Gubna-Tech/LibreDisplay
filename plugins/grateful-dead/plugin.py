import datetime
import hashlib
import html
import json
import re
from urllib.parse import quote, urlencode
from _shared import request_json, plain_text

MANIFEST={"id":"grateful-dead",
 'apiVersion': 1,
 'name': 'Deadhead · Grateful Dead',
 'description': 'Unofficial fan integration for deeply customizable Today in Dead History shows, setlists, sourced member quotes, and '
                'listening suggestions.',
 'version': '1.3',
 'icon': '✺',
 'refreshMin': 30,
 'kind': 'data',
 'category': 'Media',
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
               'min': 4,
               'max': 80,
               'step': 1},
              {'key': 'browserScrollStartDelay',
               'label': 'Browser pause before scrolling (sec)',
               'type': 'number',
               'default': 3,
               'section': 'Shows & rotation',
               'min': 0,
               'max': 30,
               'step': 1},
              {'key': 'browserScrollLoopPause',
               'label': 'Browser pause at each end / loop (sec)',
               'type': 'number',
               'default': 4,
               'section': 'Shows & rotation',
               'min': 0,
               'max': 60,
               'step': 1},
              {'key': 'browserScrollLoopMode',
               'label': 'Browser auto-scroll loop style',
               'type': 'select',
               'default': 'bounce',
               'options': [{'value': 'bounce', 'label': 'Bounce · down/up continuously'},
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
               'sectionHelp': 'Choose each outbound link independently. JerryBase and Internet Archive are the preferred source order, with other listening links remaining optional.'},
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
               'options': [{'value': 'auto', 'label': 'Automatic · JerryBase → Internet Archive → setlist.fm fallback'},
                           {'value': 'jerrybase', 'label': 'JerryBase · preferred · no key'},
                           {'value': 'archive', 'label': 'Internet Archive · preferred fallback · no key'},
                           {'value': 'setlistfm', 'label': 'setlist.fm · API key · optional fallback'}],
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
               'label': 'Maximum sets shown',
               'type': 'number',
               'default': 5,
               'section': 'Setlists',
               'min': 1,
               'max': 5,
               'step': 1},
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
               'min': 4,
               'max': 80,
               'step': 1},
              {'key': 'setlistScrollStartDelay',
               'label': 'Setlist pause before scrolling (sec)',
               'type': 'number',
               'default': 4,
               'section': 'Setlists',
               'min': 0,
               'max': 30,
               'step': 1},
              {'key': 'setlistScrollLoopPause',
               'label': 'Setlist pause at end / between loops (sec)',
               'type': 'number',
               'default': 5,
               'section': 'Setlists',
               'min': 0,
               'max': 60,
               'step': 1},
              {'key': 'setlistScrollLoopMode',
               'label': 'Setlist auto-scroll loop style',
               'type': 'select',
               'default': 'restart',
               'options': [{'value': 'restart', 'label': 'Restart · top to bottom, then top'},
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
               'help': 'Optional. JerryBase is tried first and Internet Archive second. setlist.fm is only used when explicitly selected or as an automatic fallback when a key is present.'},
              {'key': 'quotesEnabled',
               'label': 'Show member quotes',
               'type': 'checkbox',
               'default': True,
               'section': 'Quotes',
               'sectionHelp': 'Quotes can be completely hidden, independently rotated, filtered to one member, and stripped down to just '
                              'the text.'},
              {'key': 'quoteMember',
               'label': 'Quote member',
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
              {'key': 'quoteRotate', 'label': 'Rotate member quotes', 'type': 'checkbox', 'default': True, 'section': 'Quotes'},
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

# Quotes are intentionally short sourced excerpts from interviews and member archives.
QUOTES=[
    {"key":"jerry","member":"Jerry Garcia","quote":"All it takes to create another reality is for people to live in it.","source":"Grateful Dead Deadcast · Europe '72: Denmark","url":"https://www.dead.net/deadcast/europe-72-denmark"},
    {"key":"bob","member":"Bob Weir","quote":"We've always been pretty free to do the things we want.","source":"November 1972 interview","url":"https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html"},
    {"key":"phil","member":"Phil Lesh","quote":"Somehow the music would make us act in unison.","source":"Spring 1971 interview","url":"https://deadsources.blogspot.com/2013/12/spring-1971-phil-lesh-interview.html"},
    {"key":"mickey","member":"Mickey Hart","quote":"I like to create things from nothing, to make things happen.","source":"PBS NewsHour · CANVAS","url":"https://www.pbs.org/newshour/show/grateful-dead-drummer-mickey-hart-combines-music-and-art-at-the-las-vegas-sphere"},
    {"key":"bill","member":"Bill Kreutzmann","quote":"Even with the older material, you're always creating new music in the moment.","source":"Grateful Dead interview","url":"https://www.dead.net/features/dead-world-roundup/talkin-about-music-laughter-and-life-bill-kreutzmann"},
    {"key":"pigpen","member":"Ron “Pigpen” McKernan","quote":"And then I’d sing and play harmonica. Way before the Warlocks.","source":"Deadcast archival interview · 10/6/70","url":"https://www.dead.net/adventures-pigpen-part-1"},
    {"key":"keith","member":"Keith Godchaux","quote":"I don’t want to listen to it. I want to play it.","source":"Donna Jean recounting Keith · Grateful Dead Deadcast","url":"https://www.dead.net/enter-keith-godchaux"},
    {"key":"donna","member":"Donna Jean Godchaux","quote":"When I sing again, it's going to be with that band.","source":"Grateful Dead Deadcast · Donna Jean","url":"https://www.dead.net/donna-jean"},
    {"key":"brent","member":"Brent Mydland","quote":"There are people who like me and people who don’t like the fact that I’m in the band.","source":"The Golden Road interview, quoted by Phoenix New Times","url":"https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/"},
    {"key":"tom","member":"Tom Constanten","quote":"We sort of threw the spaghetti at the wall to see what would happen.","source":"Grateful Web interview · 2026","url":"https://www.gratefulweb.com/articles/we-sort-of-threw-spaghetti-at-the-wall-an-interview-with-tom-constanten-of-the-grateful-dead/"},
    {"key":"vince","member":"Vince Welnick","quote":"They’re very much a family, and that’s something you don’t find much in rock ’n’ roll anymore.","source":"Phoenix New Times interview · 1995","url":"https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/"}
]

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
        elif kind=='number': output[key]=_int(value,int(field.get('min',-100000)),int(field.get('max',100000)),int(default or 0))
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
        out.append({"key":"custom","member":plain_text(parts[0],60),"quote":plain_text(parts[1],220),"source":"Personal quote pack","url":url})
    return out

def _quote_rows(settings,today):
    rows=QUOTES+_custom_quotes(settings.get('customQuotes'))
    member=str(settings.get('quoteMember') or 'all').lower()
    if member!='all': rows=[x for x in rows if x.get('key')==member] or rows
    seed=int(hashlib.sha256((today.isoformat()+member).encode()).hexdigest()[:10],16)
    if rows:
        offset=seed%len(rows);rows=rows[offset:]+rows[:offset]
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
    return {'sets':sets[:5],'favoriteSongHits':hits,'url':final or url,'attribution':'JerryBase','sourceKind':'no-key','venue':venue}

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
    return {'sets':sets[:5],'favoriteSongHits':hits,'url':plain_text(row.get('url'),300),'attribution':'setlist.fm','sourceKind':'api-key'}

# Backwards-compatible helper name retained for companion/runtime contracts.
def _setlist_enrichment(ctx,key,show,favorites):
    return _setlistfm_enrichment(ctx,key,show,favorites)

def _setlist_for_show(ctx,settings,show,favorites):
    source=str(settings.get('setlistSource') or 'auto').lower();key=str(settings.get('setlistApiKey') or '').strip();errors=[]
    providers=[]
    if source in ('auto','jerrybase'): providers.append(('JerryBase',lambda:_jerrybase_setlist(ctx,show,favorites)))
    if source in ('auto','archive'): providers.append(('Internet Archive',lambda:_archive_track_setlist(ctx,show,favorites)))
    if source=='setlistfm' or (source=='auto' and key): providers.append(('setlist.fm',lambda:_setlistfm_enrichment(ctx,key,show,favorites)))
    for name,fn in providers:
        try:
            row=fn()
            if row and row.get('sets'): return row,errors
        except Exception as exc: errors.append(f'{name}: {str(exc)[:60]}')
    return None,errors

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
        indices=list(range(len(shows)))
        if featured_index>=0: indices=[featured_index]+[i for i in indices if i!=featured_index]
        for idx in indices[:preload]:
            row,errors=_setlist_for_show(context,settings,shows[idx],favorites)
            if row:setlists[shows[idx]['date']]=row
            setlist_errors.extend(errors)
    quotes=_quote_rows(settings,today) if display.get('quotesEnabled',True) else []
    return {
        'kind':'deadhead','provider':'Internet Archive · Relisten · JerryBase','title':display.get('headerTitle') or 'Today in Dead History','date':today.isoformat(),'monthDay':today.strftime('%B %-d') if hasattr(today,'strftime') else today.isoformat(),
        'shows':shows,'featuredIndex':featured_index,'quotes':quotes,'quote':quotes[0] if quotes else None,'setlists':setlists,'setlist':setlists.get(shows[featured_index]['date']) if shows and featured_index>=0 else None,'setlistErrors':setlist_errors[:6],'providerError':provider_error,
        'era':era,'showMode':str(settings.get('showMode') or 'today'),'showOrder':str(settings.get('showOrder') or 'oldest'),'showBrowser':display.get('showBrowser','year-strip'),'autoRotate':display.get('autoRotate',True),'rotationSeconds':_int(display.get('rotationSeconds'),15,120,30),
        'quoteRotate':display.get('quoteRotate',True),'quoteSeconds':_int(display.get('quoteSeconds'),30,300,60),'visualMode':display.get('visualMode','subtle'),'favoriteSongs':favorites,'setlistsEnabled':display.get('setlistsEnabled',True),'setlistSource':display.get('setlistSource','auto'),'display':display,
        'unofficial':True,'sources':[{'label':'JerryBase setlists','url':'https://jerrybase.com/'},{'label':'Internet Archive recordings','url':'https://archive.org/details/GratefulDead'},{'label':'Relisten','url':'https://relisten.net/grateful-dead'},{'label':'The SetList Program','url':'https://www.setlists.net/'}]
    }
