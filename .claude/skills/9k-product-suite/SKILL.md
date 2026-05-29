```markdown
# 9k-product-suite Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides a comprehensive guide to the coding conventions and development workflows used in the `9k-product-suite` JavaScript repository. It covers file naming, import/export styles, commit patterns, and testing practices, enabling contributors to maintain consistency and quality across the codebase.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `productManager.js`, `userProfileHandler.js`

### Import Style
- Use **relative imports** for modules within the repository.
  - Example:
    ```javascript
    import { fetchProduct } from './productManager';
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```javascript
    // productManager.js
    export function fetchProduct(id) { /* ... */ }
    export function updateProduct(product) { /* ... */ }
    ```

### Commit Patterns
- Commit messages are **freeform** and do not follow a strict prefix or type.
- Average commit message length: ~45 characters.
  - Example:  
    ```
    Fix product update bug in cart module
    ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature in the product suite  
**Command:** `/add-feature`

1. Create a new file using camelCase naming.
2. Implement the feature using named exports.
3. Use relative imports to include dependencies.
4. Write a corresponding test file named `featureName.test.js`.
5. Commit changes with a clear, concise message.

### Fixing a Bug
**Trigger:** When resolving a bug in the codebase  
**Command:** `/fix-bug`

1. Locate the relevant file(s) using camelCase naming.
2. Apply the bug fix.
3. Update or add tests in `*.test.js` files to cover the fix.
4. Commit with a message describing the bug fix.

### Writing Tests
**Trigger:** When adding or updating tests  
**Command:** `/write-test`

1. Create or update a test file matching the pattern `*.test.js`.
2. Write test cases for all exported functions.
3. Run tests using the project's preferred test runner (framework unknown; check project docs or scripts).
4. Commit test changes with a descriptive message.

## Testing Patterns

- Test files follow the `*.test.js` naming convention.
- Each test file should cover the corresponding module's exported functions.
- The testing framework is not specified; check project documentation or scripts for details.
- Example test file:
  ```javascript
  // productManager.test.js
  import { fetchProduct } from './productManager';

  test('fetchProduct returns correct product', () => {
    const product = fetchProduct(1);
    expect(product.id).toBe(1);
  });
  ```

## Commands
| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /add-feature   | Start workflow for adding a new feature      |
| /fix-bug       | Start workflow for fixing a bug              |
| /write-test    | Start workflow for writing or updating tests |
```
