```markdown
# labsys Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `labsys` repository, a Python-based project with both backend and frontend components. You'll learn how to structure code, follow commit and file naming conventions, and execute common workflows such as adding backend features or frontend screens. This guide is designed to help contributors maintain consistency and efficiency across the codebase.

## Coding Conventions

### File Naming
- **Convention:** camelCase
- **Example:** `userModel.py`, `dataService.py`

### Import Style
- **Convention:** Relative imports within modules
- **Example:**
  ```python
  from .models import UserModel
  from .service import processData
  ```

### Export Style
- **Convention:** Named exports (explicitly listing exported classes/functions)
- **Example:**
  ```python
  __all__ = ["UserModel", "processData"]
  ```

### Commit Messages
- **Style:** Conventional commits
- **Prefix:** `feat`
- **Example:** `feat: add user authentication service`

## Workflows

### Add Backend Feature with Model and API
**Trigger:** When introducing a new backend entity with CRUD or query API  
**Command:** `/new-backend-entity`

1. **Create a new model file** in `backend/app/models/`, e.g., `userModel.py`.
   ```python
   # backend/app/models/userModel.py
   from sqlalchemy import Column, Integer, String
   from .base import Base

   class UserModel(Base):
       __tablename__ = "users"
       id = Column(Integer, primary_key=True)
       name = Column(String)
   ```
2. **Update `backend/app/models/__init__.py`** to include the new model.
   ```python
   from .userModel import UserModel
   __all__ = ["UserModel"]
   ```
3. **Create an Alembic migration script** in `backend/alembic/versions/`.
   ```bash
   alembic revision --autogenerate -m "add user model"
   ```
4. **Implement service logic** in `backend/app/domains/<feature>/service.py`.
   ```python
   # backend/app/domains/user/service.py
   from ...models import UserModel

   def create_user(session, name):
       user = UserModel(name=name)
       session.add(user)
       session.commit()
       return user
   ```
5. **Implement API router** in `backend/app/domains/<feature>/router.py`.
   ```python
   # backend/app/domains/user/router.py
   from fastapi import APIRouter

   router = APIRouter()

   @router.post("/users/")
   def create_user_api(...):
       ...
   ```
6. **Update `backend/app/main.py`** to include the new router.
   ```python
   from app.domains.user.router import router as user_router
   app.include_router(user_router)
   ```

### Add Frontend Screen or Tab
**Trigger:** When exposing a new feature or data view in the frontend UI  
**Command:** `/new-frontend-screen`

1. **Create or update screen component** in `frontend/src/screens/`, e.g., `UserScreen.tsx`.
   ```tsx
   // frontend/src/screens/UserScreen.tsx
   import React from "react";
   export const UserScreen = () => <div>User Screen</div>;
   ```
2. **Update API hooks** in `frontend/src/api/hooks.ts`.
   ```ts
   // frontend/src/api/hooks.ts
   export const useUsers = () => { /* fetch users */ };
   ```
3. **Update or regenerate API schema** in `frontend/src/api/schema.ts` and `openapi.json`.
   - Run codegen or update types as needed.
4. **Wire up navigation or tabs** in existing screens.
   ```tsx
   // Add <UserScreen /> to navigation stack or tab bar
   ```

## Testing Patterns

- **Test File Pattern:** `*.test.*`
- **Framework:** Not explicitly detected; likely uses standard Python testing tools (e.g., `pytest`).
- **Example:**
  ```python
  # backend/app/domains/user/service.test.py
  def test_create_user():
      ...
  ```

## Commands

| Command               | Purpose                                                      |
|-----------------------|--------------------------------------------------------------|
| /new-backend-entity   | Scaffold a new backend model, migration, service, and API    |
| /new-frontend-screen  | Scaffold a new frontend screen/tab and connect to the API    |
```