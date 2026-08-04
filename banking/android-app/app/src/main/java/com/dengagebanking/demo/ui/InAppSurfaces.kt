package com.dengagebanking.demo.ui

import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.dengage.sdk.Dengage
import com.dengage.sdk.ui.inappmessage.InAppInlineElement
import com.dengage.sdk.ui.story.StoriesListView
import com.dengagebanking.demo.DengageKeys

/* The two In-App surfaces that need a view in the layout rather than just an
   SDK call: inline placements and App Stories.

   Both are addressed by a PROPERTY ID issued by the Dengage panel, not by
   anything this app can invent. Until those ids exist, each composable renders
   nothing at all rather than an empty box, so the screens look finished
   instead of broken. Fill in the two constants in DengageKeys and they light
   up with no other change.

   This mirrors how the website works: a slot exists in the page, the panel
   decides what goes in it. The difference is that the web SDK finds its slot
   by CSS selector and the mobile SDK is handed the view directly. */

/** An inline In-App placement. The screen name has to match the one passed to
 *  Dengage.setNavigation(), or the campaign is targeted at a screen the SDK
 *  does not believe you are on. */
@Composable
fun InlineInApp(screenName: String, modifier: Modifier = Modifier) {
    val propertyId = DengageKeys.InlineProperty.forScreen(screenName) ?: return
    val context = LocalContext.current
    val activity = context as? AppCompatActivity ?: return

    AndroidView(
        modifier = modifier.fillMaxWidth().padding(vertical = 6.dp),
        factory = { ctx ->
            InAppInlineElement(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }
        },
        update = { view ->
            runCatching {
                Dengage.showInlineInApp(
                    screenName = screenName,
                    inAppInlineElement = view,
                    activity = activity,
                    customParams = null,
                    propertyId = propertyId,
                    hideIfNotFound = true
                )
            }
        }
    )
}

/** The App Stories rail. The app declares the id per screen; a screen
 *  with none draws nothing.
 *
 *  IT WRAPS ITS CONTENT RATHER THAN PINNING A HEIGHT, and that one line is the
 *  whole difference. This read .height(104.dp), which undid everything
 *  hideIfNotFound buys: the flag hides the INNER view when no Story set targets
 *  the pair, but a fixed height on the Compose wrapper reserves the space
 *  anyway, so an unfilled rail sat as a permanent empty band on every screen
 *  that declares one. The file's own promise above is that a screen with no
 *  Stories "draws nothing", and only wrapContentHeight keeps it. */
@Composable
fun StoriesRail(screenName: String, modifier: Modifier = Modifier) {
    val propertyId = DengageKeys.StoryProperty.forScreen(screenName) ?: return
    val context = LocalContext.current
    val activity = context as? AppCompatActivity ?: return

    AndroidView(
        modifier = modifier.fillMaxWidth().wrapContentHeight(),
        /* WRAP_CONTENT on the hosted view too. wrapContentHeight above lets the
           Compose wrapper collapse; without this the View inside it can still
           measure itself to the full height it is offered, and the band comes
           back. Both halves are needed, which is why the inline element above
           declares the same pair. */
        factory = { ctx ->
            StoriesListView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }
        },
        update = { view ->
            runCatching {
                Dengage.showStoriesList(
                    screenName = screenName,
                    storiesListView = view,
                    activity = activity,
                    customParams = null,
                    storyPropertyId = propertyId,
                    hideIfNotFound = true
                )
            }
        }
    )
}
