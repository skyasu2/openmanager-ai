const { chromium } = require("playwright");
(async () => {
  console.log("🚀 베르셀 사이트 E2E 테스트 시작...");
  const browser = await chromium.launch({ 
    headless: false, 
    args: ["--no-sandbox", "--disable-dev-shm-usage"] 
  });
  const page = await browser.newPage();
  
  // OpenManager 베르셀 사이트 접속
  await page.goto("https://openmanager-ai.vercel.app");
  await page.waitForLoadState("networkidle");
  
  // 스크린샷 저장
  await page.screenshot({ 
    path: "openmanager-homepage.png", 
    fullPage: true 
  });
  
  // 페이지 타이틀 확인
  const title = await page.title();
  console.log(`📄 페이지 타이틀: ${title}`);
  
  // 게스트 체험 버튼 찾기
  const guestButton = await page.locator("text=게스트로 체험하기").first();
  if (await guestButton.isVisible()) {
    console.log("✅ 게스트 체험 버튼 발견");
    await guestButton.click();
    await page.waitForLoadState("networkidle");
    
    // 대시보드 스크린샷
    await page.screenshot({ 
      path: "openmanager-dashboard.png", 
      fullPage: true 
    });
    console.log("📸 대시보드 스크린샷 저장");
  }
  
  await browser.close();
  console.log("✅ E2E 테스트 완료!");
})().catch(console.error);
