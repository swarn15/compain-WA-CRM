-- ============================================================
-- 061_multi_workspace_support.sql
--
-- Enables a single user to own and manage multiple workspaces /
-- WhatsApp numbers, each with its own independent:
--   - WhatsApp Connection & Webhook routing
--   - Automations & Flows
--   - AI Chatbot & Knowledge Base
--   - Contacts, Deals, Pipelines & Inbox
-- ============================================================

-- 1. Relax the single-account-per-owner constraint
DROP INDEX IF EXISTS idx_accounts_one_per_owner;

-- 2. Multi-account membership tracking table
CREATE TABLE IF NOT EXISTS public.user_account_memberships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role public.account_role_enum NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, account_id)
);

ALTER TABLE public.user_account_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_account_memberships_select ON public.user_account_memberships;
CREATE POLICY user_account_memberships_select ON public.user_account_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Seed existing accounts into user_account_memberships
INSERT INTO public.user_account_memberships (user_id, account_id, role)
SELECT owner_user_id, id, 'owner'::public.account_role_enum
FROM public.accounts
ON CONFLICT (user_id, account_id) DO NOTHING;

-- Also seed any currently linked profiles
INSERT INTO public.user_account_memberships (user_id, account_id, role)
SELECT user_id, account_id, account_role
FROM public.profiles
WHERE account_id IS NOT NULL AND account_role IS NOT NULL
ON CONFLICT (user_id, account_id) DO UPDATE SET role = EXCLUDED.role;

-- 3. Update accounts SELECT policy so users can list all their workspaces
DROP POLICY IF EXISTS accounts_select ON public.accounts;
CREATE POLICY accounts_select ON public.accounts FOR SELECT
  USING (
    is_account_member(id)
    OR owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_account_memberships uam
      WHERE uam.user_id = auth.uid() AND uam.account_id = public.accounts.id
    )
  );

-- 4. RPC: create_workspace
CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_account_id UUID;
  v_clean_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  v_clean_name := COALESCE(NULLIF(TRIM(p_name), ''), 'New Workspace');

  -- Create the new account
  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (v_clean_name, v_user_id)
  RETURNING id INTO v_new_account_id;

  -- Record ownership membership
  INSERT INTO public.user_account_memberships (user_id, account_id, role)
  VALUES (v_user_id, v_new_account_id, 'owner')
  ON CONFLICT (user_id, account_id) DO UPDATE SET role = 'owner';

  -- Switch caller's active profile pointer to this account
  UPDATE public.profiles
  SET account_id = v_new_account_id,
      account_role = 'owner'
  WHERE user_id = v_user_id;

  RETURN v_new_account_id;
END;
$$;

ALTER FUNCTION public.create_workspace(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- 5. RPC: switch_workspace
CREATE OR REPLACE FUNCTION public.switch_workspace(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role public.account_role_enum;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Determine role
  SELECT role INTO v_role
  FROM public.user_account_memberships
  WHERE user_id = v_user_id AND account_id = p_account_id;

  IF v_role IS NULL THEN
    -- Fallback: check if owner directly
    IF EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND owner_user_id = v_user_id) THEN
      v_role := 'owner';
      INSERT INTO public.user_account_memberships (user_id, account_id, role)
      VALUES (v_user_id, p_account_id, 'owner')
      ON CONFLICT (user_id, account_id) DO NOTHING;
    ELSE
      RAISE EXCEPTION 'Access denied to this workspace' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Update active profile pointer
  UPDATE public.profiles
  SET account_id = p_account_id,
      account_role = v_role
  WHERE user_id = v_user_id;
END;
$$;

ALTER FUNCTION public.switch_workspace(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.switch_workspace(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_workspace(UUID) TO authenticated;
