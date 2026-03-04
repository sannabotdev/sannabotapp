# Contributing to Sanna

Thank you for your interest in contributing to Sanna! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Adding New Skills](#adding-new-skills)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful, inclusive, and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/SannaBot.git
   cd SannaBot
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-owner/SannaBot.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

## Development Setup

Before you start contributing, make sure you have the development environment set up:

1. **Read [DEVELOP.md](DEVELOP.md)** for detailed setup instructions
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure local settings**:
   ```bash
   cp local.config.example.ts local.config.ts
   # Edit local.config.ts with your API keys
   ```
4. **Run the app**:
   ```bash
   npm run android
   ```

**Note**: Setting up the full development environment requires multiple API keys (OpenAI/Claude, Google, Spotify, Picovoice, Slack). See [DEVELOP.md](DEVELOP.md) for details.

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug fixes**: Fix issues and improve stability
- ✨ **New features**: Add functionality or enhance existing features
- 📝 **Documentation**: Improve docs, add examples, fix typos
- 🎨 **UI/UX improvements**: Enhance the user interface and experience
- 🔧 **Refactoring**: Improve code quality and maintainability
- 🧪 **Tests**: Add or improve test coverage
- 🌟 **New skills**: Add new capabilities via `SKILL.md` files

### Contribution Workflow

1. **Check existing issues**: Look for open issues or create a new one to discuss your idea
2. **Create a branch**: Use a descriptive branch name (e.g., `feature/add-new-skill`, `fix/accessibility-bug`)
3. **Make your changes**: Follow the coding standards below
4. **Test your changes**: Ensure everything works as expected
5. **Commit your changes**: Follow the commit message guidelines
6. **Push to your fork**: `git push origin your-branch-name`
7. **Create a Pull Request**: Open a PR with a clear description

## Coding Standards

### TypeScript/JavaScript

- **Use TypeScript** for all new code
- **Follow existing code style** and patterns
- **Use meaningful variable and function names**
- **Add type annotations** where appropriate
- **Keep functions focused** and single-purpose
- **Avoid deep nesting** (max 3-4 levels)

### Code Formatting

- **Run the linter** before committing:
  ```bash
  npm run lint
  ```
- **Use Prettier** for consistent formatting (if configured)
- **Follow existing indentation** (spaces vs tabs)

### File Structure

- **Organize code logically** in the appropriate directories:
  - `src/agent/` - Agent logic and sub-agents
  - `src/tools/` - Tool implementations
  - `src/screens/` - UI screens
  - `src/components/` - Reusable components
  - `assets/skills/` - Skill definitions
- **Keep files focused** - one main responsibility per file
- **Use descriptive file names** (kebab-case for files, PascalCase for components)

### React Native Best Practices

- **Use functional components** with hooks
- **Optimize performance** - avoid unnecessary re-renders
- **Handle errors gracefully** with try-catch blocks
- **Use TypeScript types** for props and state
- **Follow React Native accessibility guidelines**

### Android-Specific Code

- **Kotlin code** should follow Kotlin conventions
- **Document native modules** clearly
- **Handle permissions** properly
- **Test on real devices** when possible

## Commit Guidelines

### Commit Message Format

We follow a conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```
feat(scheduler): add recurring task support

Allows users to create tasks that repeat daily, weekly, or monthly.
Includes UI updates and persistence layer changes.

Closes #123
```

```
fix(accessibility): handle null UI nodes gracefully

Prevents crashes when accessibility service encounters null nodes
during UI automation tasks.
```

### Best Practices

- **Write clear, descriptive commit messages**
- **Keep commits focused** - one logical change per commit
- **Reference issues** in commit messages (e.g., `Closes #123`)
- **Use present tense** ("add feature" not "added feature")
- **Keep the subject line under 72 characters**

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's coding standards
- [ ] All tests pass (if applicable)
- [ ] Linter passes without errors
- [ ] Documentation is updated (if needed)
- [ ] Changes are tested on a real device (for Android features)
- [ ] Commit messages follow the guidelines

### PR Description Template

When creating a PR, please include:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested? Include steps to reproduce.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Closes #issue-number
```

### Review Process

1. **Automated checks** must pass (linting, tests)
2. **Code review** by maintainers
3. **Address feedback** and update the PR
4. **Maintainer approval** required before merging
5. **Squash and merge** (preferred) or rebase before merging

### PR Best Practices

- **Keep PRs focused** - one feature or fix per PR
- **Keep PRs small** when possible - easier to review
- **Update your branch** regularly with upstream changes
- **Respond to feedback** promptly and constructively
- **Mark as draft** if work is in progress

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check if it's already fixed** in the latest version
3. **Gather information** about your environment

### Bug Reports

Include the following information:

- **Description**: Clear description of the bug
- **Steps to reproduce**: Detailed steps to reproduce the issue
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**:
  - Android version
  - Device model
  - App version
  - Node.js version
- **Debug logs**: If applicable, include cleaned debug logs (see [Getting Help](README.md#-getting-help))
- **Screenshots**: If applicable

### Feature Requests

- **Clear description** of the feature
- **Use case**: Why is this feature needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you've thought about

## Adding New Skills

Skills are the easiest way to contribute new functionality! See the [Adding a Skill](README.md#-adding-a-skill) section in the README.

### Skill Guidelines

- **Follow the SKILL.md format** - see existing skills in `assets/skills/`
- **Include clear examples** of usage
- **Document all tools** used in the skill
- **Test thoroughly** before submitting
- **Add to README** if it's a significant new skill

### Skill Template

```markdown
---
name: your-skill-name
description: Brief description of what this skill does
---

# Your Skill Name

## Overview
Detailed description of the skill and its capabilities.

## Usage Examples
- "Example command 1"
- "Example command 2"

## Tool: tool-name
### Action Name
Description of what this action does.

\`\`\`json
{
  "parameter": "value"
}
\`\`\`
```

## Testing

### Manual Testing

- **Test on real devices** when possible
- **Test different Android versions** if applicable
- **Test edge cases** and error conditions
- **Test with different API configurations**

### Automated Testing

- **Write unit tests** for utility functions
- **Write integration tests** for critical paths
- **Run existing tests** before submitting:
  ```bash
  npm test
  ```

### Testing Checklist

- [ ] Feature works as expected
- [ ] No regressions introduced
- [ ] Error handling works correctly
- [ ] UI is responsive and accessible
- [ ] Performance is acceptable

## Documentation

### Code Documentation

- **Add JSDoc comments** for public functions and classes
- **Document complex logic** with inline comments
- **Keep comments up-to-date** with code changes

### User Documentation

- **Update README.md** for user-facing changes
- **Update DEVELOP.md** for developer-facing changes
- **Add examples** where helpful
- **Keep screenshots current** if they change

## Questions?

If you have questions about contributing:

- **Check existing issues** and discussions
- **Open a discussion** on GitHub
- **Email**: [sannabot@proton.me](mailto:sannabot@proton.me)

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- Project documentation (where appropriate)

Thank you for contributing to Sanna! 🎉
