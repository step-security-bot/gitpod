// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"strings"

	"github.com/bufbuild/connect-go"
	humanize "github.com/dustin/go-humanize"
	"github.com/gitpod-io/gitpod-local-cli/common"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

func TranslatePhase(phase string) string {
	return strings.ToLower(phase[6:])
}

// listWorkspaceCommand lists all available workspaces
var listWorkspaceCommand = &cobra.Command{
	Use:   "list",
	Short: "Lists workspaces",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		workspaces, err := gitpod.Workspaces.ListWorkspaces(ctx, connect.NewRequest(&v1.ListWorkspacesRequest{}))
		if err != nil {
			return err
		}

		if JsonOutput {
			workspaceJSON, err := json.Marshal(workspaces.Msg.GetResult())
			if err != nil {
				fmt.Println(err)
				return err
			}
			fmt.Println(string(workspaceJSON))
			return nil
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"Workspace ID", "Phase", "Created", "Context URL"})
		table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
		table.SetCenterSeparator("|")

		for _, workspace := range workspaces.Msg.GetResult() {

			timeAgo := humanize.Time(workspace.GetStatus().Instance.CreatedAt.AsTime())

			table.Append([]string{workspace.WorkspaceId, TranslatePhase(workspace.GetStatus().Instance.Status.Phase.String()), timeAgo, workspace.Context.ContextUrl})
		}

		table.Render()

		return nil
	},
}

func init() {
	wsCmd.AddCommand(listWorkspaceCommand)
}
