const{test}=require('@playwright/test');

test('navigate to child/new page', async({browser})=>
{
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.goto('https://rahulshettyacademy.com/loginpagePractise/');
    
    const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        page.locator(':text-is("Free Access to InterviewQues/ResumeAssistance/Material")').click()
    ]);

})
test.only('Get by locator test', async({page})=>
{
await page.goto('https://rahulshettyacademy.com/angularpractice/');
await page.getByLabel('Check me out if you Love IceCreams!').click();
await page.getByLabel('Employed').check();
await page.getByLabel('Gender').selectOption('Female');
await page.getByPlaceholder('Password').fill('abhis111');
await page.getByRole('button',{name: 'Submit'}).click();
const text=await page.getByText('Success! The Form has been submitted successfully!.').isVisible();
console.log(text);
await page.getByRole('link',{name: 'Shop'}).click();
//wait page.pause();

});