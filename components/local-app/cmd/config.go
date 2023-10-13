// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod-local-cli/config"
)

var cfgCmd = &cobra.Command{
	Use:   "config",
	Short: "Change the configuration of the CLI",
}

var cfgSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Update a configuration option",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {

		if len(args) < 2 {
			return fmt.Errorf("not enough arguments")
		}

		key, value := args[0], args[1]

		config.Init()
		err := config.Set(key, value)

		if err != nil {
			return err
		}

		return nil
	},
}

var cfgGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration option",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {

		if len(args) < 1 {
			return fmt.Errorf("not enough arguments")
		}

		key := args[0]

		config.Init()
		value := config.Get(key)

		fmt.Println(value)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(cfgCmd)
	cfgCmd.AddCommand(cfgSetCmd)
	cfgCmd.AddCommand(cfgGetCmd)
}
