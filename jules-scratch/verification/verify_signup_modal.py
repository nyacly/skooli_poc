from playwright.sync_api import sync_playwright, Page, expect

def verify_signup_modal(page: Page):
    """
    This test verifies that the signup modal can be opened, switched to the
    register tab, and filled out.
    """
    # 1. Arrange: Go to the application's home page.
    page.goto("http://localhost:3000/")

    # Wait for the main content to be loaded
    print(page.content())
    expect(page.get_by_role("heading", name="Featured Products")).to_be_visible(timeout=60000)

    # 2. Act: Open the login modal and switch to the register tab.
    # The login button is in the nav
    login_button = page.locator('button[onclick="showLogin()"]')
    login_button.click()

    # The modal should be visible now
    modal = page.locator("#login-modal")
    expect(modal).to_be_visible()

    # Click the register tab
    register_tab = page.locator("#register-tab")
    register_tab.click()

    # The register form should be visible
    register_form = page.locator("#register-form-container")
    expect(register_form).to_be_visible()

    # 3. Act: Fill out the registration form.
    page.locator("#register-firstname").fill("Test")
    page.locator("#register-lastname").fill("User")
    page.locator("#register-email").fill("test.user@example.com")
    page.locator("#register-password").fill("password123")

    # 4. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_signup_modal(page)
        browser.close()

if __name__ == "__main__":
    main()
