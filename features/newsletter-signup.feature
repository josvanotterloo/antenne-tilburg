Feature: Newsletter signup

  Scenario: Successful double opt-in signup
    Given a visitor submits their name and email
    When they click the confirmation link in their email
    Then they appear as a confirmed subscriber in the admin
