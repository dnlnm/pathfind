import { NextResponse } from "next/server";

/**
 * GET /api/settings/registration
 * Returns whether open registration is currently enabled.
 * Used by the login page to decide whether to show the "Create Account" link.
 */
export async function GET() {
    const disabled = process.env.DISABLE_REGISTRATION === "true";
    return NextResponse.json({ registrationEnabled: !disabled });
}
