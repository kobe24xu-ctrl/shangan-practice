"""Isolated Chromium security regressions. Only synthetic data; all external requests mocked.

Run: python tests/security_regression.py
Requires Python Playwright and Chromium (CHROMIUM_PATH may override /usr/bin/chromium).
"""
import copy
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
passed = []
requests = []
remote_payload = None
ai_usage = {"prompt_tokens": 1, "completion_tokens": 1}
redirect_requests = False

def check(condition, label):
    assert condition, label
    passed.append(label)

def file_import(page, action, data):
    with page.expect_file_chooser() as chooser:
        page.locator(f'[data-action="{action}"]').click()
    chooser.value.set_files({'name': 'synthetic-security-test.json', 'mimeType': 'application/json', 'buffer': json.dumps(data, ensure_ascii=False).encode()})
    page.wait_for_timeout(150)

def state(page):
    return page.evaluate('JSON.parse(localStorage.getItem("sas.state.v1"))')

def seed(page, value, route='#/settings'):
    page.evaluate('(value) => {localStorage.clear(); localStorage.setItem("sas.state.v1", JSON.stringify(value));}', value)
    page.goto(origin + '/app/' + route)
    page.reload()
    page.wait_for_timeout(150)

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        context = browser.new_context(accept_downloads=True)
        def route_request(route):
            req = route.request
            if req.url.startswith(origin + '/') and '/api/' not in req.url:
                route.continue_()
                return
            requests.append({'url': req.url, 'method': req.method, 'body': req.post_data, 'headers': req.headers})
            if redirect_requests and ('/rest/v1/sas_state' in req.url or '/chat/completions' in req.url or '/api/ai/chat' in req.url):
                route.fulfill(status=302, headers={'Location': 'https://redirect-target.invalid/stolen', 'Access-Control-Allow-Origin': '*'})
                return
            if '/rest/v1/sas_state' in req.url:
                body = json.dumps([{'updated_at': '2026-11-03T00:00:00Z', 'payload': remote_payload}]) if remote_payload is not None else '[]'
                route.fulfill(status=200, content_type='application/json', body=body)
            elif '/chat/completions' in req.url or '/api/ai/chat' in req.url:
                route.fulfill(status=200, content_type='application/json', body=json.dumps({'choices': [{'message': {'content': 'synthetic response'}}], 'usage': ai_usage}))
            else:
                route.fulfill(status=200, content_type='text/plain', body='blocked by test')
        context.route('**/*', route_request)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(origin + '/app/#/settings')
        page.locator('[data-set="goal"]').fill('21')
        page.locator('[data-set="goal"]').press('Tab')
        baseline = state(page)
        check(baseline['settings']['goal'] == 21, 'App initializes and settings save')

        # Inert markup plus a range of DOM, SVG, namespace and app-action attacks.
        payloads = [
            '<img src="https://attacker.invalid/x" onerror="window.__xss=1">',
            '<svg onload="window.__xss=1"><script>window.__xss=1</script><circle cx="5" cy="5" r="4"/></svg>',
            '<svg><foreignObject><img src=x onerror="window.__xss=1"></foreignObject><use href="https://attacker.invalid/x"/><animate attributeName="href" values="javascript:alert(1)"/></svg>',
            '<a href="javascript:window.__xss=1">click</a><button data-action="ai-test">send</button>',
            '<div data-action="cloud-push" onclick="window.__xss=1" style="background:url(https://attacker.invalid/x)">text</div>',
            '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=window.__xss=1>">',
            '<svg><style><a id="</style><img src=x onerror=window.__xss=1>"></a></style></svg>',
            '<svg><path fill="url(https://attacker.invalid/x)" d="M0 0L10 10"/><a xlink:href="javascript:window.__xss=1">bad</a></svg>',
        ]
        requests.clear()
        result = page.evaluate('''(payloads) => {
          const host = document.createElement('div'); document.body.append(host);
          const html = payloads.map(SAS_SECURITY.safeStem).join(''); host.innerHTML = html;
          const forbidden = host.querySelectorAll('script,img,iframe,object,embed,a,button,input,style,foreignObject,use,animate').length;
          const attrs = [...host.querySelectorAll('*')].flatMap(el => [...el.attributes].map(a => a.name));
          host.remove(); return {forbidden, attrs, html};
        }''', payloads)
        check(result['forbidden'] == 0 and not any(a.startswith('on') or a in ['data-action', 'style', 'href', 'id'] for a in result['attrs']), 'Sanitizer removes executable markup, external references and forged app controls')
        check(page.evaluate('window.__xss || 0') == 0 and requests == [], 'Sanitizing hostile markup executes no script and makes no external request')
        safe = page.evaluate('SAS_SECURITY.safeStem(\'<b>safe</b><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="currentColor"/></svg>\')')
        check('<b>safe</b>' in safe and '<svg' in safe and '<circle' in safe and 'viewBox=' in safe, 'Basic formatting and static SVG drawing survive sanitization')

        malicious = '<img src="https://attacker.invalid/steal" onerror="window.__xss=1">'
        q = {'id': 'safe-import-001', 'module': 'ziliao', 'point': 'zl-zonghe', 'difficulty': 2, 'stem': malicious + '<b>Question</b><svg viewBox="0 0 20 20"><circle cx="5" cy="5" r="4"/></svg>', 'options': ['A', 'B'], 'answer': 1}
        invalid = [dict(q, id='x" onclick="alert(1)'), dict(q, id='constructor'), dict(q, id='bad-fraction', answer=0.5), dict(q, id='bad-difficulty', difficulty=999), dict(q, id='bad-module', module='unknown')]
        prototype_ids = page.evaluate('Object.getOwnPropertyNames(Object.prototype)') + ['prototype']
        invalid += [dict(q, id=bad_id) for bad_id in prototype_ids]
        file_import(page, 'import-bank', {'questions': [q, q] + invalid})
        imported = state(page)['imported']
        check(len(imported) == 1 and imported[0]['id'] == q['id'], 'File import rejects hostile IDs, duplicate IDs, invalid answers, difficulty and modules')
        page.goto(origin + '/app/#/quiz?review=' + q['id'])
        check(page.locator('.q-stem svg circle').count() == 1 and page.locator('.q-stem img').count() == 0, 'Imported question renders safely and preserves its SVG')
        page.locator('[data-action="choose"][data-val="1"]').click()
        expect(page.locator('.verdict.ok')).to_be_visible()
        check(page.locator('.verdict.ok').count() == 1, 'Imported question remains answerable')
        check(page.evaluate('window.__xss || 0') == 0 and requests == [], 'Imported stored XSS never executes or exfiltrates')

        # Existing built-in SVG questions and all app routes must keep working.
        page.goto(origin + '/app/#/quiz?review=pd-tx-01')
        check(page.locator('.q-stem svg').count() == 4, 'All four built-in geometric figures still render')
        page.locator('[data-action="choose"][data-val="2"]').click()
        expect(page.locator('.verdict.ok')).to_be_visible()
        check(page.locator('.verdict.ok').count() == 1, 'Built-in question answer and feedback work')
        for route in ['home', 'practice', 'exam', 'wrong', 'fav', 'graph', 'point/zl-zonghe', 'stats', 'ai', 'settings', 'about']:
            page.goto(origin + '/app/#/' + route)
        check(not errors, 'Core navigation renders without JavaScript errors')

        # Session-only keys work during the session but never enter persisted state.
        local = copy.deepcopy(baseline)
        local['settings']['ai'].update(key='FAKE_SESSION_ONLY_KEY', remember=True, proxy='direct', base='https://trusted-ai.invalid/v1')
        seed(page, local)
        page.locator('[data-set="ai.remember"]').uncheck()
        page.locator('[data-set="goal"]').fill('22')
        page.locator('[data-set="goal"]').press('Tab')
        check('FAKE_SESSION_ONLY_KEY' not in page.evaluate('localStorage.getItem("sas.state.v1")'), 'Turning remember off erases persisted key across later saves')
        page.locator('[data-set="ai.key"]').fill('FAKE_NEW_SESSION_KEY')
        page.locator('[data-set="ai.key"]').press('Tab')
        page.locator('[data-set="ai.model"]').fill('fake-model')
        page.locator('[data-set="ai.model"]').press('Tab')
        check('FAKE_NEW_SESSION_KEY' not in page.evaluate('localStorage.getItem("sas.state.v1")'), 'New key entered while remember=false never persists')
        requests.clear()
        page.locator('[data-action="ai-test"]').click()
        page.wait_for_timeout(100)
        check(len(requests) == 1 and requests[0]['headers'].get('authorization') == 'Bearer FAKE_NEW_SESSION_KEY', 'Session-only key works with a fully mocked AI request')
        page.reload()
        check(page.locator('[data-set="ai.key"]').input_value() == '', 'Reload discards session-only key')
        local['settings']['ai']['remember'] = False
        seed(page, local)
        check('FAKE_SESSION_ONLY_KEY' not in page.evaluate('localStorage.getItem("sas.state.v1")'), 'Startup removes keys left by the old remember=false persistence bug')

        # Backup is portable learning data only, even if the device remembers keys.
        local['settings']['ai'].update(remember=True, key='FAKE_BACKUP_API_KEY', cloudEndpoint='https://trusted-wb.invalid', publishableKey='wbpk_FAKE_LOCAL_ONLY')
        local['cloud'].update(enabled=True, auto=True, url='https://trusted-sync.invalid', key='FAKE_ANON_KEY', code='FAKE_SYNC_CODE_123456')
        seed(page, local)
        with page.expect_download() as download_info:
            page.locator('[data-action="export-backup"]').click()
        exported = json.loads(Path(download_info.value.path()).read_text())
        check('ai' not in exported['state']['settings'] and 'cloud' not in exported['state'] and not any(x in json.dumps(exported) for x in ['FAKE_BACKUP_API_KEY', 'FAKE_SYNC_CODE_123456', 'FAKE_ANON_KEY', 'wbpk_FAKE_LOCAL_ONLY']), 'Exported backup contains neither AI connection configuration nor sync credentials')

        incoming = copy.deepcopy(baseline)
        incoming['settings']['ai'].update(base='https://attacker.invalid/v1', key='INJECTED_KEY', provider='wb', cloudEndpoint='https://attacker.invalid', publishableKey='wbpk_ATTACKER')
        incoming['cloud'].update(enabled=True, auto=True, url='https://attacker.invalid', key='ATTACKER_SYNC_KEY', code='ATTACKER_SYNC_CODE')
        incoming['imported'] = [q] + invalid
        incoming['settings']['goal'] = '\" onfocus=window.__xss=1 x=\"'
        incoming['daily'] = {'2026-11-03': {'answered': malicious, 'right': 1}}
        incoming['records'] = {'pd-tx-01': {'seen': malicious, 'right': malicious, 'reasons': {'审题偏差': 2, '计算失误': -1, '时间不够': 0, '完全没思路': malicious}}}
        incoming['examCfg'] = {'count': 20, 'min': 25, 'off': ['ziliao', 'constructor', 'not-a-module']}
        incoming['aiUsage'].update(tin=malicious, tout=malicious, credits=malicious)
        requests.clear()
        # Schedule an upload first; restore must cancel it.
        page.clock.install()
        page.locator('[data-set="goal"]').fill('25')
        page.locator('[data-set="goal"]').press('Tab')
        file_import(page, 'import-backup', {'type': 'sas-backup', 'state': incoming})
        page.clock.fast_forward(11000)
        restored = state(page)
        check(restored['settings']['ai'] == local['settings']['ai'] and restored['cloud']['url'] == local['cloud']['url'] and restored['cloud']['code'] == local['cloud']['code'], 'Backup restore preserves complete local AI and sync configuration')
        check(requests == [], 'Backup restore cancels pending upload and performs no automatic network request')
        check(isinstance(restored['settings']['goal'], (int, float)) and restored['daily']['2026-11-03']['answered'] == 0, 'Backup scalar fields are type-checked instead of becoming HTML')
        page.goto(origin + '/app/#/quiz?review=safe-import-001')
        check(page.locator('.q-stem svg').count() == 1 and page.evaluate('window.__xss || 0') == 0, 'Restored imported questions are immediately available and sanitized')

        # Cloud restore: one explicit mocked GET only, same device connection afterward.
        remote_payload = incoming
        page.goto(origin + '/app/#/settings')
        requests.clear()
        page.locator('[data-action="cloud-pull"]').click()
        page.locator('[data-action="cloud-pull-2"]').click()
        page.wait_for_timeout(150)
        page.clock.fast_forward(11000)
        restored = state(page)
        check(len(requests) == 1 and requests[0]['method'] == 'GET' and requests[0]['url'].startswith('https://trusted-sync.invalid/'), 'Cloud restore performs only the requested trusted-source GET, without upload')
        check(restored['settings']['ai'] == local['settings']['ai'] and restored['cloud']['url'] == local['cloud']['url'], 'Cloud restore cannot replace AI or sync destinations and reuse local secrets')
        page.goto(origin + '/app/#/settings')
        requests.clear()
        page.locator('[data-action="cloud-push"]').click()
        page.wait_for_timeout(100)
        payload = json.loads(requests[0]['body'])[0]['payload']
        check('cloud' not in payload and 'ai' not in payload['settings'], 'Explicit sync payload excludes connection configurations')

        # Cached state uses the same boundary, while valid study configuration survives.
        seed(page, incoming)
        cached = state(page)
        check([item['id'] for item in cached['imported']] == [q['id']], 'Cached state rejects all Object.prototype IDs and invalid imported questions')
        check(cached['records']['pd-tx-01']['reasons'] == {'审题偏差': 2}, 'Only positive known mistake-reason counts survive cache normalization')
        check(cached['examCfg'] == {'count': 20, 'min': 25, 'off': ['ziliao']}, 'Mock exam count, duration and excluded modules survive normalization')
        page.goto(origin + '/app/#/quiz?review=safe-import-001')
        expect(page.locator('.q-stem svg circle')).to_have_count(1)
        check(page.locator('.q-stem img').count() == 0 and page.evaluate('window.__xss || 0') == 0, 'Cached hostile question renders inertly with original SVG')

        # Exercise both actual AI response handling paths with synthetic usage.
        for provider in ['custom', 'wb']:
            for value_name, value in [('html', malicious), ('negative', -7), ('huge', 1e100)]:
                clean = copy.deepcopy(baseline)
                clean['settings']['ai'].update(provider=provider, key='FAKE_USAGE_KEY', remember=True, proxy='direct', base='https://trusted-ai.invalid/v1', model='fake-model', cloudEndpoint='https://trusted-wb.invalid', publishableKey='wbpk_FAKE', cloudModel='fake-model')
                seed(page, clean, '#/ai')
                ai_usage = dict(prompt_tokens=value, completion_tokens=value, credit=value)
                page.evaluate("""usage => { window.WorkBuddyCloud = {createWorkBuddyCloud: () => ({llm: {chat: {completions: {create: async function* () {yield {choices: [{delta: {content: 'synthetic response'}}], usage};}}}}})}; }""", ai_usage)
                page.locator('#aiInput').fill('synthetic usage test')
                page.locator('[data-action="ai-send"]').click()
                page.wait_for_function("JSON.parse(localStorage.getItem('sas.state.v1')).aiUsage.calls === 1")
                page.goto(origin + '/app/#/settings')
                expect(page.locator('[data-set="goal"]')).to_be_visible()
                usage = state(page)['aiUsage']
                expected = 1e15 if value_name == 'huge' else 0
                check(usage['tin'] == expected and usage['tout'] == expected and (provider != 'wb' or usage['credits'] == expected) and page.locator('img[src*="attacker"]').count() == 0 and page.evaluate('window.__xss || 0') == 0, f'{provider} AI {value_name} usage cannot inject HTML and is bounded')

        # A late model-list response must not mutate restored state or schedule sync.
        local['settings']['ai']['provider'] = 'wb'
        seed(page, local)
        page.evaluate("""() => { window.WorkBuddyCloud = {createWorkBuddyCloud: () => ({llm: {models: {list: () => new Promise(resolve => {window.finishModels = resolve;})}}})}; }""")
        page.locator('[data-action="wb-models"]').click()
        page.wait_for_function("typeof window.finishModels === 'function'")
        requests.clear()
        file_import(page, 'import-backup', {'type': 'sas-backup', 'state': incoming})
        before_models = state(page)['settings']['ai']
        page.evaluate("window.finishModels([{id: 'stale-model', name: 'stale model'}])")
        page.wait_for_function("document.body.innerText.includes('学习数据已恢复')")
        page.clock.fast_forward(11000)
        check(state(page)['settings']['ai'] == before_models and requests == [], 'Late WorkBuddy model results cannot change restored connection or trigger uploads')
        check(state(page)['records']['pd-tx-01']['reasons'] == {'审题偏差': 2} and state(page)['examCfg']['off'] == ['ziliao'], 'Backup restore preserves positive mistake counts and mock exam exclusions')

        # Real browser fetch redirect handling with fully intercepted 302 responses.
        local['settings']['ai'].update(provider='custom', model='fake-model', proxy='direct')
        for action, proxy in [('cloud-push', 'direct'), ('cloud-test', 'direct'), ('ai-test', 'direct'), ('ai-test', 'proxy')]:
            local['settings']['ai']['proxy'] = proxy
            seed(page, local)
            requests.clear()
            redirect_requests = True
            with page.expect_event('requestfailed'):
                page.locator(f'[data-action="{action}"]').click()
            page.wait_for_timeout(100)
            check(len(requests) == 1 and not any('redirect-target.invalid' in request['url'] for request in requests), f'{action} ({proxy}) rejects credential-bearing redirects before destination request')
            redirect_requests = False

        # Legacy and backup banks above new-import limits remain intact.
        oversized = copy.deepcopy(baseline)
        oversized['imported'] = [dict(q, id=f'legacy-{i}', stem='synthetic') for i in range(5001)]
        oversized['importedMeta'] = {'points': [{'id': f'point-{i}', 'module': 'ziliao', 'name': 'synthetic'} for i in range(1001)], 'materials': [{'id': f'material-{i}', 'title': 'synthetic', 'body': 'synthetic'} for i in range(1001)]}
        oversized['records'] = {'legacy-5000': {'seen': 1, 'right': 1}}
        oversized['aiChat'] = [{'role': 'user' if i % 2 == 0 else 'assistant', 'content': f'synthetic history {i}', 'at': i} for i in range(205)]
        oversized['sessions'] = [{'id': f'session-{i}', 'mode': 'review', 'items': [{'qid': 'legacy-5000', 'chosen': 1}], 'at': i} for i in range(125)]
        seed(page, oversized)
        saved = state(page)
        check(len(saved['imported']) == 5001 and len(saved['importedMeta']['points']) == 1001 and len(saved['importedMeta']['materials']) == 1001 and saved['records']['legacy-5000']['seen'] == 1, 'Legacy oversized cache retains all valid questions, metadata and linked records')
        check(saved['aiChat'] == oversized['aiChat'] and len(saved['sessions']) == 125, 'Cache migration preserves complete chat above 200 messages, including oldest and newest, and session history')
        before = state(page)
        file_import(page, 'import-bank', {'questions': [dict(q, id='over-limit')]})
        check(state(page) == before, 'Cumulative over-limit import is rejected atomically')
        check('累计导入上限' in page.locator('body').inner_text(), 'Cumulative limit rejection explains limits to user')
        seed(page, baseline)
        file_import(page, 'import-backup', {'type': 'sas-backup', 'state': oversized})
        restored_large = state(page)
        check(len(restored_large['imported']) == 5001 and len(restored_large['importedMeta']['points']) == 1001 and len(restored_large['importedMeta']['materials']) == 1001 and restored_large['records']['legacy-5000']['seen'] == 1, 'Oversized backup restores all valid bank data without truncation')

        check(restored_large['aiChat'] == oversized['aiChat'] and len(restored_large['sessions']) == 125, 'Backup restore preserves all chat messages and sessions without silent history loss')

        endpoint_checks = page.evaluate('''() => ['javascript:alert(1)', 'http://remote.invalid', 'https://u:p@remote.invalid', 'https://remote.invalid/?secret=x', 'https://remote.invalid/#x'].every(x => !SAS_SECURITY.endpoint(x)) && !!SAS_SECURITY.endpoint('https://valid.invalid/v1') && !!SAS_SECURITY.endpoint('http://localhost:8787')''')
        check(endpoint_checks, 'Connection validation blocks insecure remote URLs, credentials, query strings and fragments')
        check(not errors, 'Entire regression suite finishes without uncaught browser errors')
        browser.close()
finally:
    server.shutdown()

print(json.dumps({'passed': len(passed), 'checks': passed}, ensure_ascii=False, indent=2))
