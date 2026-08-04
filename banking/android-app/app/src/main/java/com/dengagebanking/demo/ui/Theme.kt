package com.dengagebanking.demo.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/* Meridian's palette, the same values as the website's CSS custom properties,
   so the app and the site read as one brand in a demo that switches between
   them.

   This exists because the default Material 3 scheme is purple, and a purple
   retail bank is the first thing a banking prospect notices and the last thing
   they take seriously. */

private val Navy = Color(0xFF0A2540)
private val NavyLight = Color(0xFF14406B)
private val NavyDark = Color(0xFF061726)
private val Gold = Color(0xFFC8A44D)
private val GoldDark = Color(0xFFA8862F)
private val Cream = Color(0xFFF7F5F0)
private val Ivory = Color(0xFFEDE9E0)
private val Charcoal = Color(0xFF10202E)
private val CharcoalSoft = Color(0xFF41525F)

private val LightColours = lightColorScheme(
    primary = Navy,
    onPrimary = Color.White,
    primaryContainer = NavyLight,
    onPrimaryContainer = Color.White,
    secondary = Gold,
    onSecondary = Color.White,
    secondaryContainer = Ivory,
    onSecondaryContainer = Charcoal,
    tertiary = GoldDark,
    background = Cream,
    onBackground = Charcoal,
    surface = Color.White,
    onSurface = Charcoal,
    surfaceVariant = Ivory,
    onSurfaceVariant = CharcoalSoft,
    outline = Color(0xFFC2CBD3),
    error = Color(0xFFB3261E)
)

private val DarkColours = darkColorScheme(
    primary = Gold,
    onPrimary = NavyDark,
    secondary = Gold,
    background = NavyDark,
    onBackground = Cream,
    surface = Navy,
    onSurface = Cream,
    surfaceVariant = NavyLight,
    onSurfaceVariant = Color(0xFFC2CBD3),
    outline = Color(0xFF41525F)
)

/* Tightened from the Material defaults. Bank figures want to be large and
   confident; labels want to be small and quiet. The default scale gives both
   the same voice. */
private val MeridianType = Typography().let { base ->
    base.copy(
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.Bold, fontSize = 30.sp),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold, fontSize = 19.sp),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
        bodyMedium = base.bodyMedium.copy(fontSize = 14.sp),
        bodySmall = base.bodySmall.copy(fontSize = 12.sp, color = CharcoalSoft),
        labelSmall = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Medium)
    )
}

object MeridianColours {
    val navy = Navy
    val gold = Gold
    val cream = Cream
    val soft = CharcoalSoft
    val negative = Color(0xFFB3261E)
}

@Composable
fun MeridianTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColours else LightColours,
        typography = MeridianType,
        content = content
    )
}
