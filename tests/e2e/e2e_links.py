import subprocess
from playwright.sync_api import sync_playwright
R=[];ok=lambda n,c,d='':(R.append(bool(c)),print(('PASS ' if c else 'FAIL ')+n+(' — '+str(d) if d and not c else '')))
srv=subprocess.Popen(['node','/tmp/srv.mjs'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL);srv.stdout.readline()
WA='https://wa.me/message/M7Q7RN77CDEEK1'
try:
  with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1200,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/*',lambda r:r.abort() if not r.request.url.startswith('http://localhost') else r.continue_())
    pg.goto('http://localhost:8787/link');pg.wait_for_timeout(500)
    ok('/link requires sign-in',pg.is_visible('#login') and not pg.is_visible('#app'))
    pg.fill('#pw','correct horse battery staple');pg.click('#login button');pg.wait_for_selector('#app',state='visible')
    ok('empty state shown',not pg.is_hidden('#empty') and 'No short links' in pg.inner_text('#empty'))
    pg.fill('#nm','WA ');ok('name normalised live (lowercase, safe chars)',pg.input_value('#nm')=='wa-')
    pg.fill('#nm','wa');ok('short URL preview',pg.inner_text('#pu')=='http://localhost:8787/wa')
    pg.fill('#ur','not a url');pg.click('#cr');ok('browser blocks an invalid URL',pg.input_value('#ur')=='not a url' and pg.locator('#rows tr').count()==0)
    pg.fill('#ur','javascript:alert(1)');pg.click('#cr');pg.wait_for_timeout(300);ok('javascript: URL rejected',pg.locator('#rows tr').count()==0)
    pg.fill('#ur',WA);pg.click('#cr');pg.wait_for_selector('#msg.ok');ok('link created',pg.inner_text('#msg').endswith('/wa') and pg.locator('#rows tr').count()==1)
    r=pg.request.get('http://localhost:8787/wa',max_redirects=0);ok('/wa → 302 to the WhatsApp link',r.status==302 and r.headers['location']==WA,(r.status,r.headers.get('location')))
    pg.request.get('http://localhost:8787/WA',max_redirects=0);pg.reload();pg.wait_for_selector('#rows tr');ok('click counter updates',pg.inner_text('#rows tr td:nth-child(3)')=='2',pg.inner_text('#rows tr'))
    pg.fill('#nm','wa');pg.fill('#ur','https://example.com');pg.click('#cr');pg.wait_for_selector('#msg.bad');ok('duplicate name refused',pg.locator('#rows tr').count()==1 and 'already used' in pg.inner_text('#msg'),pg.inner_text('#msg'))
    pg.on('dialog',lambda d:d.accept('https://example.com/new') if d.type=='prompt' else d.accept())
    pg.click('#rows tr .acts button:has-text("Edit")');pg.wait_for_timeout(500)
    r=pg.request.get('http://localhost:8787/wa',max_redirects=0);ok('edit changes the destination',r.headers.get('location')=='https://example.com/new',r.headers.get('location'))
    pg.click('#rows tr .acts button:has-text("Delete")');pg.wait_for_timeout(500)
    ok('delete removes it (404)',pg.request.get('http://localhost:8787/wa',max_redirects=0).status==404 and pg.locator('#rows tr').count()==0)
    ok('no JS errors',not errs,errs);b.close()
finally: srv.terminate()
print('\n%d/%d passed'%(sum(R),len(R)))
