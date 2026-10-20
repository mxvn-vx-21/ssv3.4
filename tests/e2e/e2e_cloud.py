import subprocess,os,hashlib
from playwright.sync_api import sync_playwright
R=[];ok=lambda n,c,d='':(R.append(bool(c)),print(('PASS ' if c else 'FAIL ')+n+(' — '+str(d) if d and not c else '')))
def start(env=None):
    e=dict(os.environ);e.update(env or {});p=subprocess.Popen(['node','/tmp/srv.mjs'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=e);p.stdout.readline();return p
open('/tmp/small.bin','wb').write(bytes(range(256))*3)
big=os.urandom(9000);open('/tmp/big.dat','wb').write(big)
open('/tmp/weird name (1).exe','wb').write(b'MZ\x90\x00binary')
U='http://localhost:8787';PW='correct horse battery staple'
srv=start()
try:
  with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(accept_downloads=True,viewport={'width':1000,'height':800});pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("window.__cloudTest={chunk:2048}")
    blk=lambda r:r.abort() if not r.request.url.startswith(U) else r.continue_();pg.route('**/*',blk)
    pg.goto(U+'/cloud');pg.wait_for_timeout(400);ok('/cloud asks for sign-in',pg.is_visible('#login') and not pg.is_visible('#app'))
    pg.fill('#pw','nope nope nope nope');pg.click('#login button');pg.wait_for_timeout(500);ok('wrong password refused',pg.is_visible('#login'))
    pg.fill('#pw',PW);pg.click('#login button');pg.wait_for_selector('#main',state='visible');ok('signed in; storage ready',pg.is_visible('#main') and pg.is_hidden('#setupBox'))
    pg.set_input_files('#f',['/tmp/small.bin','/tmp/big.dat','/tmp/weird name (1).exe']);pg.wait_for_selector('.up.ok >> nth=2',timeout=15000)
    pg.wait_for_selector('#list .f >> nth=2');ok('3 files uploaded (small, chunked, odd name/type)',pg.locator('#list .f').count()==3 and '3 files' in pg.inner_text('#usage'),pg.inner_text('#usage'))
    names=pg.locator('#list .nm').all_inner_texts();ok('names preserved',set(names)=={'small.bin','big.dat','weird name (1).exe'},names)
    row=pg.locator('#list .f',has_text='big.dat')
    with pg.expect_download() as d:row.locator('a:has-text("Download")').click()
    data=open(d.value.path(),'rb').read();ok('chunked file downloads identical (sha256)',hashlib.sha256(data).hexdigest()==hashlib.sha256(big).hexdigest() and d.value.suggested_filename=='big.dat',d.value.suggested_filename)
    with pg.expect_download() as d2:pg.locator('#list .f',has_text='weird name').locator('a:has-text("Download")').click()
    ok('odd filename kept on download',d2.value.suggested_filename=='weird name (1).exe',d2.value.suggested_filename)
    pg.fill('#q','big');ok('search filters list',pg.locator('#list .f').count()==1);pg.fill('#q','')
    # share link, opened by a browser with NO session
    links=[]
    def dlg(d):
        if d.type=='prompt' and d.default_value.startswith('http'):links.append(d.default_value);d.accept()
        elif d.type=='prompt':d.accept('2')
        else:d.accept()
    pg.on('dialog',dlg)
    pg.locator('#list .f',has_text='big.dat').locator('button:has-text("Share link")').click();pg.wait_for_timeout(700)
    ok('share link created',len(links)==1 and '/c/' in links[0],links)
    anon=b.new_context(accept_downloads=True);ap=anon.new_page();ap.route('**/*',blk)
    with ap.expect_download() as d3:
        try:ap.goto(links[0])
        except Exception:pass
    ok('logged-out device can download via the link',hashlib.sha256(open(d3.value.path(),'rb').read()).hexdigest()==hashlib.sha256(big).hexdigest())
    ok('…but the cloud page/API stay private for it',ap.request.get(U+'/api/admin/cloud').status==401)
    pg.locator('#list .f',has_text='big.dat').locator('button:has-text("Revoke")').click();pg.wait_for_timeout(500)
    ok('revoked link stops working',anon.request.get(links[0]).status==404)
    # delete
    pg.locator('#list .f',has_text='small.bin').locator('button:has-text("Delete")').click();pg.wait_for_timeout(800)
    ok('delete removes the file',pg.locator('#list .f').count()==2 and not any('small.bin'==n for n in pg.locator('#list .nm').all_inner_texts()))
    ok('no JS errors',not errs,errs);b.close()
finally: srv.terminate()
# not configured
srv=start({'NO_R2':'1'})
try:
  with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page();pg.route('**/*',lambda r:r.abort() if not r.request.url.startswith(U) else r.continue_())
    pg.goto(U+'/cloud');pg.fill('#pw',PW);pg.click('#login button');pg.wait_for_selector('#app',state='visible');pg.wait_for_timeout(500)
    ok('without R2: clear setup instructions, no fake upload UI',pg.is_visible('#setupBox') and pg.is_hidden('#main') and 'r2_buckets' in pg.inner_text('#setup'));b.close()
finally: srv.terminate()
print('\n%d/%d passed'%(sum(R),len(R)))
