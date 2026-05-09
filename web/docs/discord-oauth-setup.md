# Discord OAuth Setup Guide

This guide walks you through setting up Discord OAuth for the Visual web app.

## Create the Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** (top right)
3. Enter a name (e.g., "Visual App") and accept the terms
4. Click **Create**

## Configure OAuth2 Redirect URI

1. In the left sidebar, click **OAuth2** > **General**
2. Under **Redirects**, click **Add Redirect**
3. Paste this exact URI:
   ```
   https://web-plum-seven-32.vercel.app/api/oauth?provider=discord&callback=true
   ```
4. Click **Save Changes**

## Required Scopes

The app uses these OAuth2 scopes:

| Scope | Purpose |
|-------|---------|
| `identify` | Access the user's Discord username and avatar for display in the app |
| `email` | Access the user's email address for account linking and notifications |

These scopes are requested automatically when users connect their Discord account.

## Copy Credentials

1. In the left sidebar, click **OAuth2** > **General**
2. Find **Client ID** - copy this value
3. Click **Reset Secret** to generate a client secret (or use existing if shown)
4. Copy the **Client Secret** (you won't be able to see it again)

## Add to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add these variables for the **Production** environment:

| Variable | Value |
|----------|-------|
| `DISCORD_CLIENT_ID` | Your Client ID from Discord |
| `DISCORD_CLIENT_SECRET` | Your Client Secret from Discord |
| `DISCORD_REDIRECT_URI` | `https://web-plum-seven-32.vercel.app/api/oauth?provider=discord&callback=true` |

4. Click **Save** for each variable
5. **Important**: Go to **Deployments** and click the three dots on your latest deployment, then select **Redeploy** to apply the new environment variables

## Verification

After redeploying, test the Discord connection:

1. Visit your app and navigate to the account/connections page
2. Click "Connect Discord"
3. You should be redirected to Discord's authorization page
4. After authorizing, you should return to the app with a success message
